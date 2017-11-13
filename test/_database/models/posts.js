const _ = require('lodash');

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
                return bookshelf.manager.updateRelations(model, {tags: this._tags}, options)
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

        edit: function (data) {
            return bookshelf.transaction((transacting) => {
                let post = this.forge(_.pick(data, 'id'));

                return post.fetch({transacting: transacting})
                    .then((dbPost) => {
                        if (!dbPost) {
                            throw new Error('Post does not exist');
                        }

                        return dbPost.save(_.omit(data, 'id'), {transacting: transacting});
                    });
            });
        }
    });

    return {
        Post: bookshelf.model('Post', Post)
    };
};