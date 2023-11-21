// const migrateAssets = async (sourceBucketName, targetBucketName, isFirstTimeMigration) => {
//
//     if (!sourceBucketName || !targetBucketName) {
//         return new Promise((resolve, reject) => {
//             return reject('Bucket names are empty')
//         })
//     }
//
//     const s3Client = new S3Client({
//         region: 'ap-southeast-1',
//     });
//
//
//     const cmd = new ListObjectsCommand({
//         Bucket:  sourceBucketName
//     });
//
//     try {
//
//         const { Contents } = await s3Client.send(cmd);
//
//         if (Contents?.length > 0) {
//             const copyInputObjects = []
//             const oneWeekAgoTimestamp = Date.now() - 7 * 24 * 60 * 60 * 1000;
//
//             for (let content of Contents) {
//                 const input = {
//                     "Bucket": targetBucketName,
//                     "CopySource": `/${sourceBucketName}/${content.Key}`,
//                     "Key": content.Key
//                 };
//
//                 const lastModifiedTimestamp = new Date(content.LastModified).getTime();
//
//                 // We are going to copy everything on first time migration
//                 if (isFirstTimeMigration) {
//                     copyInputObjects.push(input);
//                 } else if (lastModifiedTimestamp > oneWeekAgoTimestamp) {
//                     copyInputObjects.push(input);
//                 }
//             }
//
//             if (copyInputObjects.length > 0) {
//                 await Promise.all(copyInputObjects.map( async (x) => {
//                     const copyCmd = new CopyObjectCommand(x);
//                     await s3Client.send(copyCmd);
//                 }));
//             }
//         }
//
//     } catch (e) {
//         console.error(e);
//     }
// }

