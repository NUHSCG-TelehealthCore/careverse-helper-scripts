require('dotenv').config();
const mysql = require('mysql2');
const { S3Client, CopyObjectCommand, ListObjectsCommand } = require("@aws-sdk/client-s3");

const pool = mysql.createPool({
    connectionLimit: 1,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

const migrateAssets = async (sourceBucketName, targetBucketName, isFirstTimeMigration) => {

    if (!sourceBucketName || !targetBucketName) {
        return new Promise((resolve, reject) => {
            return reject('Bucket names are empty')
        })
    }

    const s3Client = new S3Client({
        region: 'ap-southeast-1',
    });


    const cmd = new ListObjectsCommand({
        Bucket:  sourceBucketName
    });

    try {

        const { Contents } = await s3Client.send(cmd);

        if (Contents?.length > 0) {
            const copyInputObjects = []
            const oneWeekAgoTimestamp = Date.now() - 7 * 24 * 60 * 60 * 1000;

            for (let content of Contents) {
                const input = {
                    "Bucket": targetBucketName,
                    "CopySource": `/${sourceBucketName}/${content.Key}`,
                    "Key": content.Key
                };

                const lastModifiedTimestamp = new Date(content.LastModified).getTime();

                // We are going to copy everything on first time migration
                if (isFirstTimeMigration) {
                    copyInputObjects.push(input);
                } else if (lastModifiedTimestamp > oneWeekAgoTimestamp) {
                    copyInputObjects.push(input);
                }
            }

            if (copyInputObjects.length > 0) {
                await Promise.all(copyInputObjects.map( async (x) => {
                    const copyCmd = new CopyObjectCommand(x);
                    await s3Client.send(copyCmd);
                }));
            }
        }

    } catch (e) {
        console.error(e);
    }
}

const migrateArticles = (sourceDBName, targetDBName) => {

    if (!sourceDBName || !targetDBName) {
        return new Promise((resolve, reject) => {
            return reject("DB names are empty!")
        })
    }

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

const triggerMigration = (isFirstTimeMigration) => {
    console.log('Running migration');
    // start transaction to wipe out article table from dev
    migrateArticles(process.env.SOURCE_DB_NAME, process.env.TARGET_DB_NAME)
        .then(result => {
            console.log(result);
        })
        .catch(err => {
            console.log(err);
        });

    migrateAssets(process.env.SOURCE_BUCKET_NAME, process.env.TARGET_BUCKET_NAME, isFirstTimeMigration)
        .then(result => {
            console.log(result)
        })
        .catch(err => {
            console.log(err)
        })

}
//
//
// triggerMigration(true);
