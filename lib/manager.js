'use strict';

const Promise = require('bluebird');
const _ = require('lodash');

/**
 * @TODO:
 * - proper error handling
 * - require transaction (!)
 * - add `forUpdate` lock
 */
class Manager {
    constructor(bookshelf) {
        this.bookshelf = bookshelf;
    }

    findRelated(properties, paths) {
        let related = [];

        properties = properties || {};
        paths = paths || [];

        for (let key in properties) {
            if (properties.hasOwnProperty(key)) {
                let value = properties[key];
                let ctor = value ? value.constructor : null;

                if (ctor === Array) {
                    related.push(paths.concat([key]).join('.'));

                    if (value.length) {
                        related = related.concat(this.findRelated(value[0], paths.concat([key])));
                    }
                }

                if (ctor === Object) {
                    related.push(paths.concat([key]).join('.'));

                    related = related.concat(this.findRelated(value, paths.concat([key])));
                }
            }
        }

        return related;
    }

    updateRelations(model, relations, options, pluginOptions) {
        this.pluginOptions = pluginOptions || {};

        let promises = [];
        let opts = _.cloneDeep(options || {});

        Object.keys(relations).forEach((key) => {
            let value = relations[key];
            let relation = (model[key] instanceof Function && (typeof value === 'object' || Array.isArray(value))) ? model[key](model) : null;
            let type = relation ? relation.relatedData.type : 'scalar';
            let method = 'set' + type.charAt(0).toUpperCase() + type.slice(1);
            let setter = this[method];

            // e.g. update of single fields of a model
            if (type === 'scalar') {
                return;
            }

            // setting a relationship null e.g. post.tags = null does not mean we detach all models!!
            if (value === null || value === undefined) {
                return;
            }

            promises.push(() => {
                return setter.bind(this)(model, key, value, relation, opts);
            });
        });

        return Promise.each(promises, (promise) => {
            return promise();
        }, []);
    }

    setBelongsTo(model, key, properties, relation, options) {
        let Target = relation.relatedData.target;
        let existing = model.related(key);
        let target = existing.isNew() ? Target.forge() : existing.clone();
        let fk = relation.relatedData.foreignKey;

        if (properties === null) {
            if (model.get(fk)) {
                model.set(fk, null);
            }

            return (model.isNew() || model.hasChanged()) ? model.save(null, options) : model;
        }

        return target.save(properties, options)
            .then((target) => {
                if (model.get(fk) !== target.id) {
                    model.set(fk, target.id);
                }

                model.relations[key] = target;

                return (model.isNew() || model.hasChanged()) ? model.save(null, options) : model;
            });
    }

    setBelongsToMany(model, key, models, relation, options) {
        let existingRelations = model.related(key);

        return existingRelations.fetch(options)
            .then((_existingRelations) => {
                existingRelations = _existingRelations;
                return this.setCollection(existingRelations, models, options);
            })
            .then((targets) => {
                // Enforce attach/detach IDs
                existingRelations.relatedData.parentId = model.id;
                existingRelations.relatedData.parentFk = model.id;

                return Promise.each(targets.models, (target) => {
                    if (!existingRelations.findWhere({id: target.id})) {
                        existingRelations.on('creating', (collection, data) => {
                            if (this.pluginOptions && this.pluginOptions.belongsToMany && this.pluginOptions.belongsToMany.beforeRelationCreation) {
                                return this.pluginOptions.belongsToMany.beforeRelationCreation(collection, data);
                            }
                        });

                        return existingRelations.attach(target, {transacting: options.transacting});
                    }
                }).then(() => {
                    return Promise.each(existingRelations.models, (target) => {
                        if (!targets.findWhere({id: target.id})) {
                            return existingRelations.detach(target, {transacting: options.transacting});
                        }
                    });
                }).then(() => {
                    if (this.pluginOptions && this.pluginOptions.belongsToMany && this.pluginOptions.belongsToMany.after) {
                        return this.pluginOptions.belongsToMany.after(existingRelations, targets);
                    }
                });
            })
            .then(() => {
                existingRelations.off('creating');
                return model;
            });
    }

    setHasOne(model, key, properties, relation, options) {
        let Target = relation.relatedData.target;
        let target = Target.forge(_.pick(properties, 'id'));
        let fk = relation.relatedData.foreignKey;
        let opts = _.cloneDeep(options);

        return new Promise((resolve, reject) => {
            // delete relationship
            if (!Object.keys(properties).length) {
                return resolve(target);
            }

            if (!target.id) {
                opts.method = 'insert';
                return resolve(target);
            }

            target.fetch(_.merge({}, opts, {withRelated: this.findRelated(properties)}))
                .then((result) => {
                    if (!result) {
                        opts.method = 'insert';
                        return resolve(target);
                    }

                    opts.method = 'update';
                    resolve(result);
                })
                .catch(reject);
        }).then((result) => {
            if (!Object.keys(properties).length) {
                return result.where(fk, model.id).destroy(opts);
            }

            _.each(properties, (value, key) => {
                result.set(key, value);
            });

            return result.save(fk, model.id, opts);
        }).then((result) => {
            model.relations[key] = result;
            return model;
        });
    }

    setHasMany(model, key, models, relation, options) {
        let existing = model.related(key);
        let fk = relation.relatedData.foreignKey;
        let targets;

        if (!fk) {
            throw new Error('`' + model.tableName + '#' + key + '` relation is missing `foreignKey` in `this.hasMany(Target, foreignKey)`');
        }

        models = models.map((target) => {
            if (!target[fk]) {
                target[fk] = model.id;
            }
            return target;
        });

        return existing.fetch(options)
            .then((_existing) => {
                existing = _existing;

                return this.setCollection(existing, models, options);
            })
            .then((_targets) => {
                targets = _targets;

                targets.forEach((target) => {
                    existing.add(target);
                });

                return existing.mapThen((target) => {
                    if (!targets.findWhere({id: target.id})) {
                        return target.destroy(options);
                    }
                });
            })
            .then(() => {
                model.relations[key] = targets;
                return model;
            })
            .catch((err) => {
                // @TODO: custom error!!!!
                throw err;
            });
    }

    setCollection(existing, models, options) {
        models = models || [];
        let results = [];

        // only insert models if they don't exist!
        return Promise.each(models, (properties) => {
            let exists = existing.findWhere({id: properties.id});
            let model = exists ? exists : existing.model.forge(_.pick(properties, 'id'));
            let opts = _.cloneDeep(options);

            return new Promise((resolve, reject) => {
                if (!model.id) {
                    opts.method = 'insert';
                    return resolve(model);
                }

                model.fetch(_.merge({}, opts, {withRelated: this.findRelated(properties)}))
                    .then((result) => {
                        if (!result) {
                            opts.method = 'insert';
                            return resolve(model);
                        }

                        opts.method = 'update';
                        resolve(result);
                    })
                    .catch(reject);
            }).then((result) => {
                // we have to use the result from the db and add the new properties!
                _.each(properties, (value, key) => {
                    result.set(key, value);
                });

                return result.save(null, opts)
                    .then((result) => {
                        results.push(result);
                    })
                    .catch((err) => {
                        throw err;
                    });
            });
        }).then(() => {
            return this.bookshelf.Collection.forge(results);
        });
    }
}

module.exports = function (bookshelf) {
    bookshelf.manager = new Manager(bookshelf);
};
