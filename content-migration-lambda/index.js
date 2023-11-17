require('dotenv').config();
const mysql = require('mysql2');
const { S3Client, CopyObjectCommand, ListObjectsCommand } = require("@aws-sdk/client-s3");



const migrateArticles = (sourceDBName, targetDBName) => {

    if (!sourceDBName || !targetDBName) {
        return new Promise((resolve, reject) => {
            return reject("DB names are empty!")
        })
    }

    const pool = mysql.createPool({
        connectionLimit: 1,
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });

    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                return reject("Error occurred while getting the connection");
            }
            // BEGIN TRANSACTION
            return connection.beginTransaction(err => {
                if (err) {
                    connection.release();
                    return reject("Error occurred while creating the transaction");
                }

                // EXECUTE SQL TO DELETE `articles` table
                return connection.execute(`DELETE FROM ${targetDBName}.articles`, (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            return reject("Failed to wipe out `articles` table");
                        });
                    }
                    // PROCEED TO INSERT QUERY EXECUTION
                    return connection.execute(
                        `INSERT INTO ${targetDBName}.articles 
                         (nav_title, sub_nav_title, content, created_at, published_at, title, sub_title) 
                         SELECT nav_title, sub_nav_title, content, created_at, published_at, title, sub_title from ${sourceDBName}.articles`,
                        (err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    return reject("Failed to insert to `articles` table");
                                })
                            }
                            // COMMIT TRANSACTION SINCE NO ISSUE
                            return connection.commit((err) => {
                                if (err) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        return reject("Commit failed");
                                    });
                                }
                                connection.release();
                                return resolve("Articles migrated successfully");
                            })
                        }
                    )
                })
            })
        })
    })
}


const triggerMigration = () => {
    console.log('Running migration');
    // start transaction to wipe out article table from dev
    migrateArticles(process.env.SOURCE_DB_NAME, process.env.TARGET_DB_NAME)
        .then(result => {
            console.log(result);
        })
        .catch(err => {
            console.log(err);
        });
}

triggerMigration();
