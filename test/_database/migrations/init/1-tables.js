exports.up = function up(options) {
    let connection = options.connection;
    let schema = connection.schema;

    return schema.createTable('posts', function (table) {
        table.increments('id').primary().nullable(false);
        table.string('title');
    }).createTable('tags', function (table) {
        table.increments('id').primary().nullable(false);
        table.string('slug').unique().nullable(false);
    }).createTable('posts_tags', function (table) {
        table.increments('id').primary().nullable(false);
        table.integer('post_id').nullable(false).references('posts.id');
        table.integer('tag_id').nullable(false).references('tags.id');
        table.integer('sort_order').nullable(false).defaultTo(0);
    });
};