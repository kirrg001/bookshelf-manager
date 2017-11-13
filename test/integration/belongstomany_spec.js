'use strict';

const Promise = require('bluebird');
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

    it('fetch', function () {
        return models.Post.fetchAll({withRelated: ['tags']})
            .then(function (posts) {
                posts.length.should.eql(2);
                posts.models[0].related('tags').length.should.eql(0);
                posts.models[1].related('tags').length.should.eql(2);
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
                    }
                }
            }
        };

        return _.each(Object.keys(editCases), function (key) {
            it(`edit:${key}`, function () {
                let editCase = editCases[key]();

                return models.Post.edit(_.merge({id: 2}, editCase.values))
                    .then(function (result) {
                        return editCase.expect(result);
                    });
            });
        });
    });
});