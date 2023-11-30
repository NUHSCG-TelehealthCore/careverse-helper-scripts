const mysql = require('mysql2');
require("dotenv").config();

exports.handler = (event, context, callback) => {
    // Prevent the Lambda function from timing out
    context.callbackWaitsForEmptyEventLoop = false;

    const sourceDBName = process.env.SOURCE_DB_NAME;
    const targetDBName = process.env.TARGET_DB_NAME;

    if (!sourceDBName || !targetDBName) {
        return callback(new Error("DB names are empty!"));
    }

    const pool = mysql.createPool({
        connectionLimit: 1,
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });


    pool.getConnection((err, connection) => {
        if (err) {
            return callback(new Error("Error occurred while getting the connection"));
        }

        // Begin transaction
        connection.beginTransaction(err => {
            if (err) {
                connection.release();
                return callback(new Error("Error occurred while creating the transaction"));
            }

            connection.execute(`SET FOREIGN_KEY_CHECKS = 0;`, err => {
                if (err) {
                    connection.release();
                    return callback(new Error("Error occurred while creating the transaction"));
                }

                // Execute SQL to delete articles table
                connection.execute(`DELETE FROM ${targetDBName}.articles`, (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            return callback(new Error("Failed to wipe out `articles` table"));
                        });
                    }

                    // Proceed to insert query execution
                    connection.execute(
                        `INSERT INTO ${targetDBName}.articles
                     (id, nav_title, sub_nav_title, content, created_at, published_at, title, sub_title, article_type)
                     SELECT id, nav_title, sub_nav_title, content, created_at, published_at, title, sub_title, article_type
                     FROM ${sourceDBName}.articles`,
                        (err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    return callback(new Error("Failed to insert into `articles` table " + err.message));
                                });
                            }

                            // Commit transaction since no issue
                            connection.commit(err => {
                                if (err) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        return callback(new Error("Commit failed"));
                                    });
                                }

                                // Files table delete
                                connection.execute(`DELETE FROM ${targetDBName}.files;`, err => {
                                    if (err) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            return callback(new Error("Failed to delete `files` table " + err.message));
                                        });
                                    }
                                    // Files table insert
                                    connection.execute(`
                                    INSERT INTO ${targetDBName}.files
                                    SELECT * FROM ${sourceDBName}.files;
                                `, err => {
                                        if (err) {
                                            return connection.rollback(() => {
                                                connection.release();
                                                return callback(new Error("Failed to insert into `files` table " + err.message));
                                            });
                                        }

                                        // files_folder_links table delete
                                        connection.execute(`DELETE FROM ${targetDBName}.files_folder_links;`, err => {
                                            if (err) {
                                                return connection.rollback(() => {
                                                    connection.release();
                                                    return callback(new Error("Failed to delete `files_folder_links` table " + err.message));
                                                });
                                            }
                                            // files_folder_links table insert
                                            connection.execute(`
                                            INSERT INTO ${targetDBName}.files_folder_links
                                            SELECT * FROM ${sourceDBName}.files_folder_links;
                                        `, err => {
                                                if (err) {
                                                    return connection.rollback(() => {
                                                        connection.release();
                                                        return callback(new Error("Failed to insert into `files_folder_links` table " + err.message));
                                                    });
                                                }

                                                // files_related_morphs table delete
                                                connection.execute(`DELETE FROM ${targetDBName}.files_related_morphs;`, err => {
                                                    if (err) {
                                                        return connection.rollback(() => {
                                                            connection.release();
                                                            return callback(new Error("Failed to delete `files_related_morphs` table " + err.message));
                                                        });
                                                    }
                                                    // files_related_morphs table insert
                                                    connection.execute(`
                                                    INSERT INTO ${targetDBName}.files_related_morphs
                                                    SELECT * FROM ${sourceDBName}.files_related_morphs;
                                                `, err => {
                                                        if (err) {
                                                            return connection.rollback(() => {
                                                                connection.release();
                                                                return callback(new Error("Failed to insert into `files_related_morphs` table " + err.message));
                                                            });
                                                        }

                                                        connection.release();
                                                        return callback(null, "Contents migrated successfully");

                                                    })
                                                })

                                            })
                                        })

                                    })
                                })
                            });
                        }
                    );
                });
            });
        });
    });

};
