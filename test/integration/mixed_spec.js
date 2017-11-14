'use strict';

const _ = require('lodash');
const models = require('../_database/models');
const testUtils = require('../utils');

describe('[Integration] Mixed', function () {
    beforeEach(function () {
        return testUtils.database.reset()
            .then(function () {
                return testUtils.database.init();
            });
    });

    describe('fetch', function () {
        it('existing', function () {
            return models.Post.fetchAll({withRelated: ['news', 'tags']})
                .then(function (posts) {
                    posts.length.should.eql(2);
                    posts.models[0].related('news').toJSON().should.eql({});
                    posts.models[1].related('news').toJSON().should.eql(testUtils.fixtures.getAll().posts[1].news);

                    posts.models[0].related('tags').length.should.eql(0);
                    posts.models[1].related('tags').length.should.eql(2);
                });
        });
    });

    describe('edit', function () {
        const editCases = {
            editExistingRelationsAndPost: function () {
                return {
                    values: {
                        title: 'only-me',
                        news: {
                            id: testUtils.fixtures.getAll().posts[1].news.id,
                            keywords: 'future,something'
                        },
                        tags: [
                            {
                                slug: 'football'
                            }
                        ]
                    },
                    expect: function (result) {
                        result.get('title').should.eql('only-me');
                        result.related('news').toJSON().keywords.should.eql('future,something');
                        result.related('tags').models.length.should.eql(1);
                        result.related('tags').models[0].get('slug').should.eql('football');
                    }
                }
            }
        };

        return _.each(Object.keys(editCases), function (key) {
            it(key, function () {
                let editCase = editCases[key]();

                return models.Post.edit(_.merge({id: editCase.id || 2}, editCase.values), editCase.options || {})
                    .then(function (result) {
                        return editCase.expect(result);
                    })
                    .catch(function (err) {
                        if (err instanceof should.AssertionError) {
                            throw err;
                        }

                        return editCase.expect(err);
                    });
            });
        });
    });
});