const mysql = require('mysql2');

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
                     (nav_title, sub_nav_title, content, created_at, published_at, title, sub_title) 
                     SELECT nav_title, sub_nav_title, content, created_at, published_at, title, sub_title 
                     FROM ${sourceDBName}.articles`,
                    (err) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                return callback(new Error("Failed to insert into `articles` table"));
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
                            connection.release();
                            return callback(null, "Articles migrated successfully");
                        });
                    }
                );
            });
        });
    });
};
