const Promise = require('bluebird');
const models = require('../../models');
const testUtils = require('../../../utils');

exports.up = function up() {
    const posts = [
        {
            title: 'First Post'
        },
        {
            title: 'Second Post',
            tags: [
                {
                    slug: 'slug1'
                },
                {
                    slug: 'slug2'
                }
            ],
            news: {
                keywords: 'future,world,sun-down'
            }
        }
    ];

    return Promise.each(posts, function (post) {
        return models.Post.add(post).then(function (result) {
            testUtils.fixtures.add('posts', result.toJSON({withRelated: ['tags', 'news']}));
        });
    });
};