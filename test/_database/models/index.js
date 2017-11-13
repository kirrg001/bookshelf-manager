const _ = require('lodash');
const Bookshelf = require('bookshelf');

exports.init = function (connection) {
    let bookshelf = Bookshelf(connection);

    ['posts', 'tags'].forEach((table) => {
        const Model = require('./' + table);
        _.extend(exports, Model(bookshelf));
    });
};