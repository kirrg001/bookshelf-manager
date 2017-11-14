'use strict';

const _ = require('lodash');
const models = require('../_database/models');
const testUtils = require('../utils');

describe('[Integration] BelongsToMany: Posts/Tags', function () {
    beforeEach(function () {
        return testUtils.database.reset()
            .then(function () {
                return testUtils.database.init();
            });
    });

    describe('fetch', function () {
        it('existing', function () {
            return models.Post.fetchAll({withRelated: ['tags']})
                .then(function (posts) {
                    posts.length.should.eql(2);
                    posts.models[0].related('tags').length.should.eql(0);
                    posts.models[1].related('tags').length.should.eql(2);
                });
        });
    });

    describe('edit', function () {
        const editCases = {
            deleteAllExistingTags: function () {
                return {
                    values: {
                        tags: [],
                    },
                    expect: function (result) {
                        result.get('title').should.eql(testUtils.fixtures.getAll().posts[1].title);
                        result.related('tags').length.should.eql(0);

                        return testUtils.database.getConnection()('posts_tags')
                            .then(function (result) {
                                result.length.should.eql(0);
                            })
                            .then(function () {
                                return testUtils.database.getConnection()('tags');
                            })
                            .then(function (result) {
                                result.length.should.eql(2);
                            });
                    }
                }
            },
            addNewTagAndKeepExisting: function () {
                return {
                    values: {
                        title: 'case2',
                        tags: [
                            {
                                id: testUtils.fixtures.getAll().posts[1].tags[0].id,
                                slug: testUtils.fixtures.getAll().posts[1].tags[0].slug
                            },
                            {
                                slug: 'case2'
                            }
                        ]
                    },
                    expect: function (result) {
                        result.get('title').should.eql('case2');
                        result.related('tags').length.should.eql(2);

                        result.related('tags').models[0].id.should.eql(testUtils.fixtures.getAll().posts[1].tags[0].id);
                        result.related('tags').models[0].get('slug').should.eql(testUtils.fixtures.getAll().posts[1].tags[0].slug);

                        result.related('tags').models[1].get('slug').should.eql('case2');

                        return testUtils.database.getConnection()('posts_tags')
                            .then(function (result) {
                                result.length.should.eql(2);
                            })
                            .then(function () {
                                return testUtils.database.getConnection()('tags');
                            })
                            .then(function (result) {
                                result.length.should.eql(3);
                            });
                    }
                }
            },
            noChanges: function () {
                return {
                    values: {
                        tags: [
                            {
                                id: testUtils.fixtures.getAll().posts[1].tags[0].id,
                                slug: testUtils.fixtures.getAll().posts[1].tags[0].slug
                            },
                            {
                                id: testUtils.fixtures.getAll().posts[1].tags[1].id,
                                slug: testUtils.fixtures.getAll().posts[1].tags[1].slug
                            }
                        ]
                    },
                    expect: function (result) {
                        result.get('title').should.eql(testUtils.fixtures.getAll().posts[1].title);
                        result.related('tags').length.should.eql(2);

                        result.related('tags').models[0].id.should.eql(testUtils.fixtures.getAll().posts[1].tags[0].id);
                        result.related('tags').models[0].get('slug').should.eql(testUtils.fixtures.getAll().posts[1].tags[0].slug);

                        result.related('tags').models[1].id.should.eql(testUtils.fixtures.getAll().posts[1].tags[1].id);
                        result.related('tags').models[1].get('slug').should.eql(testUtils.fixtures.getAll().posts[1].tags[1].slug);

                        return testUtils.database.getConnection()('posts_tags')
                            .then(function (result) {
                                result.length.should.eql(2);
                            })
                            .then(function () {
                                return testUtils.database.getConnection()('tags');
                            })
                            .then(function (result) {
                                result.length.should.eql(2);
                            });
                    }
                }
            },
            addDuplicates: function () {
                return {
                    values: {
                        tags: [
                            {
                                id: testUtils.fixtures.getAll().posts[1].tags[0].id,
                                slug: testUtils.fixtures.getAll().posts[1].tags[0].slug
                            },
                            {
                                slug: testUtils.fixtures.getAll().posts[1].tags[0].slug
                            }
                        ]
                    },
                    expect: function (result) {
                        result.message.should.match(/unique/gi);

                        return testUtils.database.getConnection()('posts_tags')
                            .then(function (result) {
                                result.length.should.eql(2);
                            })
                            .then(function () {
                                return testUtils.database.getConnection()('tags');
                            })
                            .then(function (result) {
                                result.length.should.eql(2);
                            });
                    }
                }
            },
            ensureOrder: function () {
                return {
                    values: {
                        tags: [
                            {
                                slug: 'something'
                            },
                            {
                                id: testUtils.fixtures.getAll().posts[1].tags[1].id,
                                slug: testUtils.fixtures.getAll().posts[1].tags[1].slug
                            },
                            {
                                id: testUtils.fixtures.getAll().posts[1].tags[0].id,
                                slug: testUtils.fixtures.getAll().posts[1].tags[0].slug
                            }
                        ]
                    },
                    expect: function () {
                        return testUtils.database.getConnection()('posts_tags').orderBy('sort_order', 'ASC')
                            .then(function (result) {
                                result.length.should.eql(3);
                                result[0].sort_order.should.eql(0);
                                result[0].sort_order.should.eql(0);

                                result[1].sort_order.should.eql(1);
                                result[1].tag_id.should.eql(testUtils.fixtures.getAll().posts[1].tags[1].id);

                                result[2].sort_order.should.eql(2);
                                result[2].tag_id.should.eql(testUtils.fixtures.getAll().posts[1].tags[0].id);
                            })
                            .then(function () {
                                return testUtils.database.getConnection()('tags');
                            })
                            .then(function (result) {
                                result.length.should.eql(3);
                            });
                    }
                }
            },
            setNull: function () {
                return {
                    options: {
                        withRelated: ['tags']
                    },
                    values: {
                        tags: null
                    },
                    expect: function (result) {
                        result.get('title').should.eql(testUtils.fixtures.getAll().posts[1].title);
                        result.related('tags').length.should.eql(2);

                        result.related('tags').models[0].id.should.eql(testUtils.fixtures.getAll().posts[1].tags[0].id);
                        result.related('tags').models[0].get('slug').should.eql(testUtils.fixtures.getAll().posts[1].tags[0].slug);

                        result.related('tags').models[1].id.should.eql(testUtils.fixtures.getAll().posts[1].tags[1].id);
                        result.related('tags').models[1].get('slug').should.eql(testUtils.fixtures.getAll().posts[1].tags[1].slug);

                        return testUtils.database.getConnection()('posts_tags')
                            .then(function (result) {
                                result.length.should.eql(2);
                            })
                            .then(function () {
                                return testUtils.database.getConnection()('tags');
                            })
                            .then(function (result) {
                                result.length.should.eql(2);
                            });
                    }
                }
            }
        };

        return _.each(Object.keys(editCases), function (key) {
            it(key, function () {
                let editCase = editCases[key]();

                return models.Post.edit(_.merge({id: 2}, editCase.values), editCase.options || {})
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