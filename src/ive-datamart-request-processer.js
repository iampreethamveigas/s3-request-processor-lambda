var AWS = require('aws-sdk');
var glue = new AWS.Glue();
var s3 = new AWS.S3();
const lambda = new AWS.Lambda();
const dbConfig = require('../config/_config.db')




let batchFlow = false;
let business_entity;


var db_host = process.env.db_host;


var db_user = process.env.db_user;
var db_pass = process.env.db_pass;
var db_name = process.env.db_name;
var db_schema = process.env.db_schema;
const data = {};

module.exports.ive_datamart_request_processer = async (event, callback) => {

    try {

        var req_id;
        const workDayId = JSON.stringify(event.workDayId);
        console.log('workDayId  ** ' + workDayId);
        if (typeof (workDayId) != "undefined") {
            batchFlow = false;
        }
        else {


            batchFlow = true;
            console.log("Event is null");
        }
        var currentdate = new Date();
        //var formattedDate = currentdate.getFullYear().toString() + currentdate.getMonth() + 1 + (currentdate.getDate()) + currentdate.getHours() + currentdate.getMinutes() + currentdate.getSeconds() + currentdate.getMilliseconds();
        var formattedDate = currentdate.getFullYear() +
            ("0" + (currentdate.getMonth() + 1)).slice(-2) +
            ("0" + (currentdate.getDate())).slice(-2) +
            ("0" + currentdate.getHours()).slice(-2) +
            ("0" + currentdate.getMinutes()).slice(-2) +
            ("0" + currentdate.getSeconds()).slice(-2) +
            ("0" + currentdate.getMilliseconds()).slice(-3);

        let refNoArr = [];
        let urnArr = [];
        let ssnArr = [];
        let prodMonthArr = [];
        let prodWeekArr = [];
        let lineOfDateArr = [];
        let prodPathArr = [];
        let katashikiArr = [];
        let extArr = [];
        let intArr = [];
        let specTotalArr = [];
        let busEntityArr = [];
        let reqIdArr = [];
        let userIdArr = [];

        console.log(" batchFlow ** " + batchFlow);


        const pool = new pg.Pool(dbConfig);

        if (batchFlow == true) {

            /** Business Enity for batch flow 
             * Reading the business enitity from the file in s3 bucket
            **/

            var bucket = event.Records[0].s3.bucket.name;
            var fileKey = event['Records'][0]['s3']['object']['key'];
            var params = { Bucket: bucket, Key: fileKey };


            const readBusEntityFromS3 = (params) => {
                return new Promise((resolve, reject) => {
                    {
                        s3.getObject(params, function (err, data) {
                            if (!err) {
                                var fileContent = data.Body.toString();
                                var jsonObj = JSON.parse(fileContent);
                                console.log("values** " + jsonObj['business_entity']);
                                business_entity = jsonObj['business_entity'];
                                return resolve(data);
                            }

                            else {
                                console.log(err);
                                return reject(err);

                            }
                        });
                    }
                });
            };


            const resp = await readBusEntityFromS3(params)

            console.log("busi_outside " + business_entity);

            /**Request ID generation for batch **/
            req_id = formattedDate + 'W' + business_entity + '000000';

        }
        else {

            let records = event.records;
            business_entity = records[0].business_entity;
            req_id = formattedDate + 'U' + business_entity + workDayId;

            for (let i = 0; i < records.length; i++) {
                refNoArr.push(records[i].ref_no);
                urnArr.push(records[i].urn);
                ssnArr.push(records[i].ssn);
                prodMonthArr.push(records[i].prod_month);
                prodWeekArr.push(records[i].prod_week);
                prodPathArr.push(records[i].prod_path);
                lineOfDateArr.push(records[i].lineoff_date);
                katashikiArr.push(records[i].katashiki);
                extArr.push(records[i].ext);
                intArr.push(records[i].int);
                specTotalArr.push(records[i].spec_total_200);
                busEntityArr.push(records[i].business_entity);
                reqIdArr.push(req_id);
                userIdArr.push(workDayId);
            }

        }

        //Insert record APV_IVE_JOBS_PROCESSING_STATUS table


        const sql = "INSERT INTO " + db_schema + ".APV_IVE_JOBS_PROCESSING_STATUS (job_id,job_name,start_time,status,business_entity) VALUES ($1,$2,$3,$4,$5)";
        const values = ['MoveToProcessing_'.concat(formattedDate), 'MoveToProcessing', currentdate, 'InProgress', business_entity];

        console.log('testt' + values);

        const resp = await pool.query(sql, values);

        if (resp.err) { console.log('error'); }
        else {
            console.log('fetched response');
            const resultString = JSON.stringify(resp);
            console.log("Insert into status table " + resultString);
        }

        //Insert record VEHICLE_DATA_REQUEST_INFO table 

        var req_user = '00000';
        // var req_date = formattedDate;
        var req_type = 'Weekly';
        var req_status = 'Started';

        const sqlReqInfo = "INSERT INTO apv_ive.VEHICLE_DATA_REQUEST_INFO(Request_Id,userid,Requested_date,Request_Type,status,Business_Entity) VALUES ($1,$2,$3,$4,$5,$6)";
        const valuesReqInfo = [req_id, req_user, currentdate, req_type, req_status, business_entity];

        console.log("valreqinfo " + valuesReqInfo);

        const respReqInfo = await pool.query(sqlReqInfo, valuesReqInfo);
        const resultStringReqInfo = JSON.stringify(respReqInfo);
        console.log("Insert into reqInfo " + resultStringReqInfo);


        if (batchFlow == true) {
            /** Calling glue job to insert req_details table **/

            const get_glue_job_done = (params) => new Promise(async (resolve, reject) => {
                await glue.startJobRun(params, function (err, data) {
                    if (err) reject(err.stack); // an error occurred
                    else {
                        resolve(data);       // successful response

                    }
                });
            });

            console.log("before calling glue - bus-entity " + business_entity);
            //Invoke job run

            var params = {
                JobName: 'apv_insert_vehicle_data_request_detail',
                Arguments: {
                    '--business_entity': business_entity,
                    '--reqId': req_id,
                    '--userId': req_user,
                    '--HOST': db_host,
                    '--USER': db_user,
                    '--PW': db_pass,
                    '--DB': db_name,
                    '--SCHEMA': db_schema
                }

            };
            const response_to_return = {
                statusCode: 200,
                body: JSON.stringify('Job 3 executed successfully!'),
            };


            const glue_response = await get_glue_job_done(params);

            glue_response.then(response => {
                console.log("After glue job");
                callback(null, response_to_return);

            }).catch(error => {
                callback(error, {});

            });
        }
        else {
            /** Insert the values to from UI  vehicle_data_request_details table **/
            //const sqlInsertUI = "INSERT INTO " + db_schema + ".vehicle_data_request_details (requestid,refno,urn,prodmonth,prodweek,lineoffdate,ssn,prodpath,katashiki,ext,int,spectotal200,userid,business_entity) VALUES ($1::text[],$2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[],$8::text[],$9::text[],$10::text[],$11::text[],$12::text[],$13::text[],$14::text[])";
            //const valuesUI = ['MoveToProcessing_'.concat(formattedDate), 'MoveToProcessing', currentdate, 'InProgress', business_entity];
            const sqlInsertUI = "INSERT INTO " + db_schema + ".vehicle_data_request_details (request_id,ref_no,urn,prod_month,prod_week,lineoff_date,ssn,prod_path,katashiki,ext,int,spectotal200,userid,business_entity) SELECT * FROM UNNEST ($1::text[],$2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[],$8::text[],$9::text[],$10::text[],$11::text[],$12::text[],$13::text[],$14::text[])";
            var valuesArr = [[reqIdArr], [refNoArr], [urnArr], [prodMonthArr], [prodWeekArr], [lineOfDateArr], [ssnArr], [prodPathArr], [katashikiArr], [extArr], [intArr], [specTotalArr], [userIdArr], [busEntityArr]];

            const resp = await pool.query(sqlInsertUI, valuesArr);
            if (resp.err) { console.log('error'); }
            else {
                console.log('fetched response');
                const resultString = JSON.stringify(resp);
                console.log("Insert into details table " + req_id);
                data.requestid = req_id;

            }

        }

        let input = {
            requestid: req_id,
            business_entity: business_entity
        };
        console.log("input to job 4** " + input);


        var triggerbucket = 'ive-trigger-nqc-req';

        const putfileToS3 = (triggerbucket, key, data) => {
            return new Promise((resolve, reject) => {
                {
                    let s3 = new AWS.S3({ signatureVersion: 'v4' });

                    let filename = key + '.json';

                    const params = { Bucket: triggerbucket, Key: filename, Body: JSON.stringify(data), ContentType: 'json' };
                    s3.putObject(params, function (err, data) {
                        if (err) return reject(err);
                        return resolve(data);
                    });
                }
            });
        };

        //call functions
        const s3fileStatus = await putfileToS3(triggerbucket, req_id, input);
        console.log(" Writing to json file. Invoking job 4 " + s3fileStatus);


    } catch (err) {
        console.error(err);
        console.log("Error " + err)
        data.error = 'Exception has occured';
    }



    console.log("data resp " + data.requestid);
    const response = {
        statusCode: 200,
        body: JSON.stringify(data),
    };
    if (batchFlow == false) {
        return response;
    }
};


