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
             * e.g.
             * this.relations = ['tags']
             */
            this.on('saving', function (model) {
                this._tags = model.get('tags');
                model.unset('tags');
            });

            this.on('saved', function (model, attributes, options) {
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
        }
    });

    return {
        Post: bookshelf.model('Post', Post)
    };
};