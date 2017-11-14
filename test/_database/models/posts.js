const _ = require('lodash');
const Promise = require('bluebird');

module.exports = function (bookshelf) {
    bookshelf.plugin('registry');
    bookshelf.plugin(require('../../../lib/manager'));

    let Post = bookshelf.Model.extend({
        tableName: 'posts',

        initialize: function () {
            /**
             * @TODO: make this whole part of the plugin!
             *
             * - destroy does not trigger saved (!)
             * - combine both!
             *
             * e.g.
             * this.relations = ['tags']
             */
            this.on('saving', function (model) {
                // ONLY IF relations were passed
                if (model.hasChanged('tags')) {
                    this._tags = model.get('tags');
                    model.unset('tags');
                }
            });

            // @TODO: we have to destroy the relationships before the model get's destroyed!
            // @TODO: the plugin should check if the operation is DELETE, then it auto destroys all relations
            this.on('destroying', function (model, options) {
                return bookshelf.manager.updateRelations(model, {tags: []}, options)
                    .then(() => {
                        delete this._tags;
                    });
            });

            this.on('saved', function (model, attributes, options) {
                if (!this._tags) {
                    return;
                }

                const pluginOptions = {
                    belongsToMany: {
                        after: function (existing, targets) {
                            return Promise.each(targets.models, function (target, index) {
                                return existing.updatePivot({
                                    sort_order: index
                                }, _.extend({}, options, {query: {where: {tag_id: target.id}}}));
                            });
                        }
                    }
                };

                return bookshelf.manager.updateRelations(model, {tags: this._tags}, options, pluginOptions)
                    .then(() => {
                        delete this._tags;
                    });
            });
        },

        tags: function () {
            return this.belongsToMany('Tag').withPivot('sort_order').query('orderBy', 'sort_order', 'ASC');
        }
    }, {
        add: function (data) {
            return bookshelf.transaction((transacting) => {
                let post = this.forge(data);
                return post.save(null, {transacting: transacting});
            });
        },

        edit: function (data, options) {
            return bookshelf.transaction((transacting) => {
                let post = this.forge(_.pick(data, 'id'));

                return post.fetch(_.merge({transacting: transacting}, options))
                    .then((dbPost) => {
                        if (!dbPost) {
                            throw new Error('Post does not exist');
                        }

                        return dbPost.save(_.omit(data, 'id'), _.merge({transacting: transacting}, options));
                    });
            });
        },

        destroy: function (data) {
            return bookshelf.transaction((transacting) => {
                return this.forge(_.pick(data, 'id'))
                    .destroy({transacting: transacting});
            });
        }
    });

    return {
        Post: bookshelf.model('Post', Post)
    };
};