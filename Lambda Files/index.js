"use strict";
//TODO Fill in your phone number you wish to send one time passwords to here in E.164 format.
const PHONE_NUMBER = "Enter Your phone number here";
//TODO Fill in your Alexa Skill ID here
const APP_ID = "Enter your App ID here"; 
/*TODO Fill in the AWS account number of the account with the roll you wish to assume 
to read from another AWS account's trails. If this is the same account as the account
hosting this lambda function, change this value to null*/
const ACCOUNT_NUMBER = "Enter the account number of the trails you wish to read from here";
/*TODO Fill in the external id of the role made to read from another AWS account's trails
If this is the same account as the one hosting this lambda function, change this to null*/
const EXTERNAL_ID = "Enter the external id of the role you wish to use";
//TODO Set USE_MULTIFACTOR_AUTHORIZATION to false if you wish to disable MultiFactorAuthorization
const USE_MULTIFACTOR_AUTHORIZATION = true;
//TODO Set your PIN here as a string if you do not want a randomly generated PIN
const PIN = null;
//TODO Fill in the email(s) you wish to send your list of events to. This can also be an array
var recipientEmails = "toEmail@email.com";
//TODO Fill in the email that you wish to send your list of events from. This can also be an array
var sourceEmail = "fromEmail@email.com";
//TODO Fill in the different event names you wish to match on
var eventNames = ["ConsoleLogin","CreateTrail","CreateBucket","CreateLogStream","ModifyVPCAttribute"];
//TODO Fill in the different resource types you wish to match on
var resourceTypes = ["CloudTrail Trail","S3 Bucket","EC2 VPC"];
//TODO Fill in the different usernames you wish to match on
var usernames = ["Bob"];
//TODO Fill in the different resource names you wish to match on
var resourceNames = ["testRole","root"];
const ROLE_SESSION_NAME = "AlexaCloudTrail";
const ROLE_ARN = "arn:aws:iam::" + ACCOUNT_NUMBER + ":role/" + ROLE_SESSION_NAME;
var ASSUME_ROLE_PARAMS = {        
        RoleArn: ROLE_ARN,
        RoleSessionName: ROLE_SESSION_NAME,
        ExternalId: EXTERNAL_ID,
};
var aws  = require('aws-sdk');
//Default Region
aws.config.update({region:'us-east-1'});
const INVALID_REGION = "invalid region";
const INVALID_LOOKUP_ATTRIBUTE = "invalid lookup attribute";
const REDIRECT_TO_LOGIN = "redirecting to login";
const REDIRECT_TO_SET_AND_SEND_PIN = "redirecting to set and send pin";
const REDIRECT_TO_SEND_RESPONSE = "redirecting to send response";
var AlexaSkill = require('./AlexaSkill');
var speechOutputs = require('./SpeechOutputs');
var regions = {};
var async = require('async');
var util = require('util');
/*Used to format strings with injected variables
i.e "{0} World{1}.format("Hello","!") returns "Hello World!"
Taken from Stack overflow: http://stackoverflow.com/a/4673436*/
if (!String.prototype.format) {
    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) { 
            return typeof args[number] != 'undefined'
                ? args[number]
            : match
            ;
        });
    };
}


//Used to concatenate the input together to make a resource type in the form of "AWS::AWSSERVICE::RESOURCETYPE"
function formatResourceType(resourceType) {
    var split = resourceType.split(" ");
    if(split.length != 2) {
        throw "Error. Invalid resource type given";
    }
    return "AWS::" + split[0] + "::" + split[1];
}

//Used to determine which set of attributes to check lookup values on
function determineEventAttributeList(lookupAttribute) {
    switch(lookupAttribute) {
        case "EventName":
            return eventNames;
        case "Username":
            return usernames;
        case "ResourceType":
            return resourceTypes;
        case "ResourceName":
            return resourceNames;
        default:
            return INVALID_LOOKUP_ATTRIBUTE;
    }
}


/*Computes the minimum number of moves (insertions, deletions and replacements) needed to change string one to string two
Used to find the closest string to a given input
This is known as the Wagner-Fishcer Algorithim: https://en.wikipedia.org/wiki/Wagner%E2%80%93Fischer_algorithm*/
function getMinimumDistance(one, two) {
    if(typeof(one) != "string" || typeof(two) != "string") {
        throw new TypeError;
    }
    var lengthOfStringOne = one.length;
    var lengthOfStringTwo = two.length;
    var tempOne = one.toLowerCase();
    var tempTwo = two.toLowerCase();
    var matrix = [];
    for(var i = 0; i <= lengthOfStringOne; i++) {
        matrix[i] = new Array(lengthOfStringTwo);
    }
    for(var a = 0; a <= lengthOfStringOne; a++) {
        for(var b = 0; b <= lengthOfStringTwo; b++) {
            matrix[a][b] = 0;
        }
    }
    for(var k = 0; k <= lengthOfStringOne; k++) {
        matrix[k][0] = k;
    }
    for(var j = lengthOfStringTwo; j >= 0; j--) {
        matrix[0][j] = j;
    }
    var costOfSub = 0;
    for(var x = 1; x <= lengthOfStringOne; x++) {
        for(var y = 1; y <= lengthOfStringTwo; y++) {
            if(tempOne.charAt(x-1) === tempTwo.charAt(y-1)) {
                costOfSub = 0;
            } else {
                costOfSub = 1;
            }
            matrix[x][y] = Math.min((matrix[x - 1][y] + 1),Math.min((matrix[x][y-1] + 1), (matrix[x-1][y-1] + costOfSub)));
        }
    }
    return matrix[lengthOfStringOne][lengthOfStringTwo];
}



var LookUpEventsSkill = function(){
    AlexaSkill.call(this,APP_ID);
};

LookUpEventsSkill.prototype = Object.create(AlexaSkill.prototype);
LookUpEventsSkill.prototype.constructor = LookUpEventsSkill;
exports.handler = function (event, context) {
    var skill = new LookUpEventsSkill();
    skill.execute(event, context);
};

//Called when the session starts
LookUpEventsSkill.prototype.eventHandlers.onSessionStarted = function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
            ", sessionId=" + session.sessionId);
};

//Called when the user launches the skill without specifying what they want.
LookUpEventsSkill.prototype.eventHandlers.onLaunch = function onLaunch(launchRequest, session, response) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
            ", sessionId=" + session.sessionId);
    getWelcomeResponse(response,session,ACCOUNT_NUMBER,EXTERNAL_ID,USE_MULTIFACTOR_AUTHORIZATION);
};

//Called when the user specifies an intent for this skill.
LookUpEventsSkill.prototype.intentHandlers = {
       
    //This is the structure for adding your own lookup command. Check the readme for details    
    "SampleLookupIntent": function (intent, session, response) {
        lookup(intent,session,response,"AttributeKey","AttributeValue","OutputGeneratorFunction",
                "StartDate","EndDate");
    },
    "ValidatePIN": function (intent, session, response) {
        validateUserPIN(intent,session,response,intent.intent.slots.UserPIN.value,
                session.attributes.PIN);
    },
    "GetCloudTrailData": function (intent, session, response) {
        lookup(intent,session,response,intent.intent.slots.AttributeKey.value,
                intent.intent.slots.AttributeValue.value,getEventCount,
                intent.intent.slots.StartDate,intent.intent.slots.EndDate);
    },
    "LookupByEventName": function (intent, session, response) {
        lookup(intent, session, response, "Event Name",
                intent.intent.slots.EventName.value,getEventCount,
                intent.intent.slots.StartDate,intent.intent.slots.EndDate); 
    },
    "GetUserActivity": function (intent, session, response) {
        lookup(intent, session, response, "Username",intent.intent.slots.Username.value
                ,getUserActivity,intent.intent.slots.StartDate,
                intent.intent.slots.EndDate);
    },
    "GetEventsByDate": function (intent, session, response) {
        lookup(intent, session, response, undefined,
                undefined,getEventCount,
                intent.intent.slots.StartDate,intent.intent.slots.EndDate);
    },
    "SetRegion": function (intent, session, response) {
        setRegion(intent, session, response, intent.intent.slots.RegionName.value);
    },
    "SetPositiveTimeOffset": function (intent, session, response) {
        setTimeOffset(intent, session, response,intent.intent.slots.TimeOffset.value);
    },
    "SetNegativeTimeOffset": function (intent, session, response) {
        setTimeOffset(intent, session, response,intent.intent.slots.TimeOffset.value * -1);
    },
    "EnableEmail": function (intent, session, response) {
        emailSwitch(intent, session, response, true);
    },
    "DisableEmail": function (intent, session, response) {
        emailSwitch(intent,session,response, false);
    },
    "GetResourceActivity": function(intent,session,response) {
        lookup(intent,session,response,"Resource Type",
                intent.intent.slots.ResourceValue.value,resourceActivity,
                intent.intent.slots.StartDate,undefined);
    },
    "AMAZON.HelpIntent": function (intent, session, response) {
        var speechText = "";
        speechText = generateRepromptText();
        var speechOutput = {
                speech: speechText,
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        var repromptOutput = {
                speech: speechText,
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        // For the repromptText, play the speechOutput again
        response.ask(speechOutput, repromptOutput);
    },
    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    },
    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    }
};

/*Called when the user ends the session.
Is not called when the skill returns shouldEndSession=true.*/
LookUpEventsSkill.prototype.eventHandlers.onSessionEnded = function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
            ", sessionId=" + session.sessionId);
};

//Called on start up. Gives Welcome message and tries to assume the role with the CloudTrail trails to be read
function getWelcomeResponse(response,session,accountNumber,externalId,useMFA) {
    if(typeof(useMFA) !== "boolean" || !session) {
        throw "Error. Invalid value sent in for Multi-factor Authorization or missing session";
    }
    console.log("In Welcome Response");
    var cardTitle = "Welcome";
    var speechOutput = speechOutputs.welcomeResponse.welcome;
    var speechOutputWithRepromptText = speechOutput + speechOutputs.welcomeResponse.reprompt;
/*     If the user either does not reply to the welcome message or says something that is not
     understood, they will be prompted again with this text.*/
    var repromptText = speechOutputs.welcomeResponse.reprompt;
    if(accountNumber && externalId) {
        logInToCloudTrail(session,response,ASSUME_ROLE_PARAMS,speechOutput,repromptText,cardTitle);
        return REDIRECT_TO_LOGIN;
    }
    else {
        redirectBasedOnMFA(session,response,speechOutput, repromptText, cardTitle, useMFA, PIN);
        return "Not assuming a role";
    }

}

//Sets a random six-digit PIN in the session attributes and sends it to the user via text message
function setAndSendPIN(speechOutput,repromptText,cardTitle,response,session,phoneNumber,randomPIN,userPIN) {
    var params = {}
    if(!userPIN) { //If randomPin exists and the user doesn't have a hard-coded one
        if(!phoneNumber || !randomPIN || !(typeof(phoneNumber) === "string") || !(typeof(randomPIN) === "string")
                || phoneNumber.length < 0 || randomPIN.length < 0) {
            throw "Error. Missing at least one attribute for setAndSendPIN or the attributes given were invalid.";
        }
        session.attributes.PIN = randomPIN;
        var sns = new aws.SNS();
        params = {
                    Message: randomPIN, 
                    PhoneNumber: phoneNumber
                };
        sns.publish(params, function(err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
            } else {
                sendResponse(speechOutput, repromptText, cardTitle, response, session);
            }
          });
    }else if(typeof(userPIN) !== "string" || userPIN.length <= 0){
        throw "Error. invalid type or length for user-coded PIN";
        
    } else {
        session.attributes.PIN = (userPIN?userPIN:randomPIN);
        sendResponse(speechOutput, repromptText, cardTitle, response, session);
    }
    return params;
}

//Generates a random six-digit PIN
function generateRandomPIN() {
    var randomPIN = "";
    for(var k = 0; k < 6; k++) { //Creates a random six-digit string
        randomPIN = randomPIN +  (Math.random() * 10 | 0);
    }
    return randomPIN;
}

//Used to determine if the PIN entered by the user matches the one stored in the Skill
function validateUserPIN(intent,session,response,userPIN,actualPIN) {
    var repromptText = generateRepromptText();
    var speechOutput = "";
    if(session.attributes.isUserPINValidated) {
        speechOutput = speechOutputs.validateUserPIN.alreadyValid;
    } else {
        if(actualPIN) {
            if(userPIN === actualPIN) {
                speechOutput = speechOutputs.validateUserPIN.success;
                session.attributes.isUserPINValidated = true;
                session.attributes.PIN = null;
            } else { //invalid PIN
                speechOutput = speechOutputs.validateUserPIN.failure;
                repromptText = speechOutputs.welcomeResponse.reprompt; //Prompt to set the PIN again
            } 
       } else { //PIN has not been generated. This is a developer problem, so an error is thrown
                 //The code flow should guarantee that a PIN is generated before this method is called
            throw "Error. No PIN has been generated"
        }
    } 
    sendResponse(speechOutput,repromptText,intent.intent.name,response,session);
    return speechOutput;
}


//Used to concatenate the input together and turn into CamelCase
function concatenateInput(value){ 
    var valueSplit = value.split(" ");
    var newValue = "";
    for(var i = 0; i < valueSplit.length; i++) {
        newValue = newValue + valueSplit[i].substring(0,1).toUpperCase() + valueSplit[i].substring(1).toLowerCase();
    }
    return newValue;
}

//Assumes a role in another aws account that allows cloud trail read only access
function logInToCloudTrail(session,response,params, speechOutput, repromptText, cardTitle) {
    console.log("In role assumption");
    //This needs to be asynchronous because the role must be assumed before the credentials to log in with can be extracted
    async.waterfall([
                     function assumingRole(logInCallback) {
                         assumeRole(params,logInCallback)
                     },
                     function loggingIn(requestData,finishCallback) {
                         logIn(requestData,finishCallback);
                     },
                     function finish(data,done) {
                         redirectBasedOnMFA(session,response,speechOutput, repromptText, cardTitle, 
                                 USE_MULTIFACTOR_AUTHORIZATION,PIN);
                     }],
                     function(err, status) {
                        handleLogInToCloudTrailErrors(err, session, response, speechOutput, 
                                repromptText, cardTitle,USE_MULTIFACTOR_AUTHORIZATION,
                                ROLE_ARN,ROLE_SESSION_NAME,ACCOUNT_NUMBER);
                    }
    );
}

//Assumes the role from another AWS account
function assumeRole(params,logInCallback) {
    var sts = new aws.STS();
    sts.assumeRole(params,logInCallback);
}

//Logs in using the credentials from assume role
function logIn(requestData,finishCallback) {
    console.log("Loggining in...");
    if(requestData && requestData.Credentials && requestData.Credentials.AccessKeyId 
            && requestData.Credentials.SecretAccessKey && requestData.Credentials.SessionToken) {
        var credentials = requestData.Credentials;
        aws.config.update({
            accessKeyId: credentials.AccessKeyId,
            secretAccessKey: credentials.SecretAccessKey,
            sessionToken: credentials.SessionToken
        });
        finishCallback();
    }
    else
        throw "Error. Missing one or more parameters in logIn";
}

//Handles any issues or false alarms from assuming the role
function handleLogInToCloudTrailErrors(err, session, response, speechOutput, repromptText, cardTitle, useMFA,
        roleArn,roleSessionName,accountNumber) {
    if(!roleArn || typeof(roleArn) !== "string" || !roleSessionName || typeof(roleSessionName) !== "string"
        || !accountNumber || typeof(accountNumber) !== "string") {
        throw "Error. Missing parameters for handling errors";
    }
    if(err && err.name && err.name ===  "AccessDenied") {
        var errorName = err.toString();
        var errorNameSubSection = errorName.substring(0,errorName.indexOf(roleArn));
        if(!(errorNameSubSection.includes(roleSessionName)) || 
                !(errorNameSubSection.includes(accountNumber))) { 
            //The assumed role is trying to assume itself is fine, but any other
            //access denied issues should be pointed out
            sendResponse(errorName,repromptText,
                    "Access Denied",response,session);
            return "Access Denied";
            
        } else {
            redirectBasedOnMFA(session,response,speechOutput, repromptText, cardTitle, 
                   useMFA,PIN);
            return "Access permitted";
        }
    }
    else {
        console.log(err, err.stack);
        throw err;
    }
}

//Redirect the function depending on whether or not Multi-factor Authorization is enabled
function redirectBasedOnMFA(session,response,speechOutput, repromptText, cardTitle, useMFA, userPIN) {
    if(typeof(useMFA) !== "boolean") {
        throw "Error. Invalid value sent in for Multi-factor Authorization";
    }
    if(useMFA) {//If using Multi-factor authorization, set a pin
        if(userPIN) {
            setAndSendPIN(speechOutput+repromptText,repromptText,cardTitle,response,session,
                    PHONE_NUMBER,null,userPIN);
            return "using user-coded PIN";
        } else {
            setAndSendPIN(speechOutput+repromptText,repromptText,cardTitle,response,session,
                    PHONE_NUMBER,generateRandomPIN(),null);
            return "using random PIN";
        }
    } else {//else, just send a response and let them do lookup
        session.attributes.isUserPINValidated = true;
        sendResponse(speechOutput+generateRepromptText(),
                generateRepromptText(),cardTitle,response,session);
        return REDIRECT_TO_SEND_RESPONSE;
    }
}

//Changes user inputed region to the formal region name for AWS
function parseRegion(regionName) {
    if(Object.keys(regions).length < 1) {
        importRegions();
    }
    var awsRegion = "";
    var min = regionName.length/3;
    for(let regionNames of Object.keys(regions)) {
        var tempMin = getMinimumDistance(regionNames, regionName);
        if(tempMin < min){
            min = tempMin;
            awsRegion = regions[regionNames]; //match to the aws region name corresponding to the one spoken by the user
        }
    }
    if(awsRegion.length < 1)
        return INVALID_REGION;
    return awsRegion;
}

//Imports the region names from the AWSRegions json file
function importRegions() {
    var regionsFile = require('./AWSRegions');
    for(let region of Object.keys(regionsFile)) {
        {
            for(let regionName of Object.keys(regionsFile[region]))
            {
                regions[regionName] = region;
            }
        }
    }
    return regions;
}

//Sets the AWS region from the user
function setRegion(intent,session,response,region) {
    var cardTitle = intent.intent.name;
    var speechOutput = "";
    var repromptText = generateRepromptText();
    var regionName = parseRegion(region);
    if(regionName === INVALID_REGION) {
        speechOutput = speechOutputs.setRegion.failure;    
    } else {
        speechOutput = speechOutputs.setRegion.success.format(region);
        aws.config.update({region: regionName});
    }

    sendResponse(speechOutput, repromptText, cardTitle, response, session);
    return speechOutput;
}

//Helper function used to send responses to Alexa
function sendResponse(speechOutput, repromptText, cardTitle, response, session) {
    response.askWithCard(makeResponse(speechOutput, repromptText, cardTitle, response,session));
}

//Helper function used to make responses to send to Alexa
function makeResponse(speechOutput, repromptText, cardTitle, response, session) {
    if(speechOutput && typeof(speechOutput) === "string" && repromptText && typeof(repromptText) === "string" 
        && cardTitle && typeof(cardTitle) === "string" && response && session) {
        var repromptOutput = {
                speech: repromptText,
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        var speechOutputObject = {
                speech: speechOutput,
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        return response.mockResponse(speechOutputObject, repromptOutput, cardTitle, speechOutput,response,session);
    }
    else {
        throw "Error. One of the parameters sent in is null, undefined, or the wrong type.";
    }
}

//Turns on/off email services
function emailSwitch(intent,session,response,enable) {
    var speechText = "";
    if(typeof(enable) !== "boolean") {
        throw "Error. Invalid type for enable. Should be a boolean.";
    }
    session.attributes.isEmailEnabled = enable; //true for enabled, false for disabled
    var enabledOrDisabled = "disabled";
    if(enable) {
        enabledOrDisabled = "enabled";
    }
    speechText = speechOutputs.emailSwitch.success.format(enabledOrDisabled);
    var cardTitle = intent.intent.name;
    sendResponse(speechText,generateRepromptText(),cardTitle,response,session);
    return speechText;
}



//Sends an email containing the given events
function sendEmail(emails, events, speechOutput, repromptText, cardTitle, response, session, sourceEmail, subjectLine) {
    var ses = new aws.SES();
    var params = {};
    //Used to check the conditions to send an email
    var shouldSendEmail = true;
    shouldSendEmail = shouldSendEmail && session && session.attributes && session.attributes.isEmailEnabled
        && shouldSendEmail && emails && events && events.length > 0 && sourceEmail;
    if(shouldSendEmail) {
        var emailText = "The result of your Alexa query is:\n";
        for(let item of events)  {
            var x = JSON.stringify(JSON.parse(item.CloudTrailEvent),null,4);
            emailText = emailText + x + "\n\n\n";
        }
        params = {
                Destination: { /* required */
                    ToAddresses: [
                                  emails
                                  ]
                },
                Message: { /* required */
                    Body: { /* required */
                        Text: {
                            Data: emailText, /* required */
                            Charset: 'UTF-8'
                        }
                    },
                    Subject: { /* required */
                        //TODO Make sure to set the subject line constant at the beginning of the code
                        Data: subjectLine, /* required */ 
                        Charset: 'UTF-8'
                    }
                },
                Source: sourceEmail, /* required */
        };
        ses.sendEmail(params, function(err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
                speechOutput = speechOutput + speechOutputs.sendEmail.failure;
            } else {
                console.log(speechOutputs.sendEmail.success.format(emails)); // successful response
            }
            sendResponse(speechOutput, repromptText, cardTitle, response, session);
        });
    }

}

//Used to make a date and make sure it does not have a year past the current year
function adjustedDate(dateString) {
    var date = new Date(dateString);
    var currentDate = new Date();
    var currentYear = currentDate.getFullYear();
    if(date.getFullYear() > currentYear) {
        /*If no year is specified and the month and/or day are before today, Alexa parses the date as the next year
        Example: the user says June 10th and today is June 11th 2016, Alexa passes in June 10th 2017*/
        date.setFullYear(currentYear);
    }
    return date;
}

//Looks up the CloudTrail item(s) attributeKey with the value attributeValue at the given date
function lookup(intent, session, response, lookupAttribute, lookupValue, outputGenerator,userStartDate,userEndDate) {
    if (typeof(outputGenerator) != 'function') {
        throw "Error. Output generator is not of type function.";
    }
    var cloudtrail = new aws.CloudTrail();
    var cardTitle = intent.intent.name;
    var repromptText = generateRepromptText();
    var speechOutput = "";
    if(lookupAttribute) {
        if(lookupAttribute !== "user name") {
            lookupAttribute = concatenateInput(lookupAttribute);
        }
        else {
            lookupAttribute = "Username";
        }
    } else if(lookupValue){ //error since there is a value but no attribute to match it with
        speechOutput = speechOutputs.lookup.noLookupAttribute;
    }
    var realLookupValue = "";
    if(lookupValue) {
    //if statement is used to find the closest event name to the one specified by the user
        var attributes = determineEventAttributeList(lookupAttribute);
        if(attributes === INVALID_LOOKUP_ATTRIBUTE) {
            speechOutput = speechOutputs.lookup.invalidLookupAttribute;
        } else {
            /* min is the number of changes required to transform lookupValue to the closest event name
             the default value for it is used to specify that an event name must have at least 
             half of the correct letters to be considered close enough*/
            var min = lookupValue.length/2; 
            for(let item of attributes) {
                if(item.length > 0) { //Prevents matching with whitespace
                    var tempMin = getMinimumDistance(item,lookupValue);
                    if(min > tempMin && tempMin < Math.min(item.length,lookupValue.length)) {
                        min = tempMin;
                        realLookupValue = item;
                    }
                }
            }
            if(realLookupValue.length <= 1)  {// no value was able to be matched to what the user inputed
                speechOutput = speechOutputs.lookup.invalidLookupValue;
            }
            //Resource types have their own unique format
            if(!(realLookupValue.length <= 1) && lookupAttribute === "ResourceType") {
                realLookupValue = formatResourceType(realLookupValue);
            }
        }
    } else if(lookupAttribute){ //error since there is a lookup attribute but not value to match it on
        speechOutput = speechOutputs.lookup.noLookupValue;
    }
    if(speechOutput.length < 1) {     //if no error yet, do the lookup
        var defaultStartDate = 'Wed Dec 31 1969 16:00:00 GMT-0800 (PST)';
        var startDate = new Date(defaultStartDate);
        var endDate = new Date(); //current time and date
        if(userStartDate && userStartDate.value) {
            startDate = adjustedDate(userStartDate.value);
        }
        if(userEndDate && userEndDate.value){
            endDate = adjustedDate(userEndDate.value);
        } 
        if(startDate > endDate) {
            var tempDate = startDate;
            startDate = endDate;
            endDate = tempDate;
        }
        endDate.setHours(23,59,59,999);
        //If the user specified a time offset, use it
        if(session.attributes.offset) {
            startDate.setTime(startDate.getTime() - session.attributes.offset*60*60*1000);
            endDate.setTime(endDate.getTime() - session.attributes.offset*60*60*1000);
        }
        var lookupAttributes = [];
        if(lookupAttribute && lookupValue) {
            lookupAttributes = [
                                {
                                    AttributeKey: lookupAttribute, 
                                    AttributeValue: realLookupValue  
                                }
                                ]
        }
        var params = {  
                EndTime: endDate,
                LookupAttributes: lookupAttributes,
                StartTime: startDate
        };
        console.log(JSON.stringify(params,null,4));
        cloudtrail.lookupEvents(params,function(err, data){          
            if (err) {
                console.log(err, err.stack);
                if(speechOutput.length < 1) {//if no error output has been specified earlier
                    speechOutput = speechOutputs.lookup.lookupFailed;
                }
            } else { //lookup successful
                speechOutput = outputGenerator(data.Events,lookupAttribute,lookupValue, userStartDate, userEndDate);
            }
            if(session.attributes.isEmailEnabled && data.Events.length > 0) { //send an email if email is enabled and there are events to email
                var subjectLine = "Number of Events with a " + lookupAttribute + " of " + lookupValue;
                sendEmail(recipientEmails,data.Events,speechOutput,repromptText,cardTitle, response, session, sourceEmail, subjectLine);
            } else {
                sendResponse(speechOutput, repromptText, cardTitle, response, session);
            }
        });
        return params;
    }
    else {
        sendResponse(speechOutput, repromptText, cardTitle, response, session);
        return {};
    }
}


//Gets the count of events given an attribute and a value for that attribute. Also can use dates
function getEventCount(Events, attributeKey, attributeValue, userStartDate, userEndDate) {
    if(attributeKey && !attributeValue || attributeValue && !attributeKey) {
        throw speechOutputs.getEventCount.attributeError;
    }
    var count = Events.length;
    var speechOutput = speechOutputs.getEventCount.start;
    if(attributeKey && attributeValue) {
        speechOutput = speechOutput + speechOutputs.getEventCount.lookupVariables.format(attributeKey,attributeValue);
    }
    if((userStartDate && userStartDate.value) || (userEndDate && userEndDate.value)) {
        speechOutput = speechOutput + speechOutputs.getEventCount.dates;
    }
    speechOutput = speechOutput + speechOutputs.getEventCount.end.format(count);
    return speechOutput;
}

//Gets the count of events and the name of events done by a certain user
function getUserActivity(Events, USERNAME, userNameValue, userStartDate, userEndDate) {
    if(!userNameValue) {
        throw speechOutputs.getUserActivity.usernameError;
    }
    var count = Events.length;
    var eventSet = new Set();
    for(var k = 0; k < count; k++) {
        eventSet.add(Events[k].EventName);
    }
    var speechOutput = speechOutputs.getUserActivity.start.format(userNameValue,eventSet.size,count);
    if((userStartDate && userStartDate.value) || (userEndDate && userEndDate.value)) {
        speechOutput = speechOutput + speechOutputs.getUserActivity.dates;
    }
    if(eventSet.size > 0) {
        var countOfEvents = 0; 
        var userEvents = "";
        for(let item of eventSet) {
            if(countOfEvents >= 5) { //Used to make sure not too many events are given to Alexa
                break;
            }
            userEvents = userEvents + item + ", ";
            countOfEvents = countOfEvents + 1;
        }
        userEvents = userEvents.substring(0,userEvents.length-2) + ".";
        speechOutput = speechOutput +  speechOutputs.getUserActivity.listEvents.format(userNameValue,userEvents);
    }

    return speechOutput;
}

//Adds the time offset to the session attributes so it can be used for all calls in the session
function setTimeOffset(intent, session, response, timeOffset)  {
    if(!Number(timeOffset)) {
        throw "Error. Invalid type for timeOffset."
    }
    var cardTitle = intent.intent.name;
    var repromptText = generateRepromptText();
    var plusOrMinus = "";
    if(timeOffset > 0) {
        plusOrMinus = "plus ";
    } else if(timeOffset < 0) {
        plusOrMinus = "minus ";
    }
    session.attributes.timeOffset = timeOffset;
    var speechOutput = speechOutputs.setTimeOffset.format(plusOrMinus,Math.abs(timeOffset));
    sendResponse(speechOutput, repromptText, cardTitle, response, session);
    return speechOutput;
}

//Tells the user whether or not there was activity from a certain resource
function resourceActivity(Events,RESOURCE_TYPE,ResourceValue,userStartDate,USER_END_DATE) {
    var speechOutput = "";
    if(Events.length < 1) {
        speechOutput = speechOutputs.resourceActivity.noActivity.format(ResourceValue);
    } else {
        speechOutput = speechOutputs.resourceActivity.activity.format(ResourceValue);
    }
    return speechOutput;
}


//Randomly generates reprompt text
function generateRepromptText() {
    var listOfChoices = Object.keys(speechOutputs.reprompt.randomReprompt);
    var choice = Math.random() * listOfChoices.length | 0;
    return speechOutputs.reprompt.start + listOfChoices[choice] + speechOutputs.reprompt.middle + speechOutputs.reprompt.randomReprompt[listOfChoices[choice]];
}


//Used if you would like to test the functions in another file
exports.generateRepromptTextTest = generateRepromptText;
exports.lookupTest = lookup;
exports.getEventCountTest = getEventCount;
exports.emailSwitchTest = emailSwitch;
exports.sendEmailTest = sendEmail;
exports.getUserActivityTest = getUserActivity;
exports.getEventCountTest = getEventCount;
exports.formatResourceTypeTest = formatResourceType;
exports.getMinimumDistanceTest = getMinimumDistance;
exports.getWelcomeResponseTest = getWelcomeResponse;
exports.concatenateInputTest = concatenateInput;
exports.sendResponseTest = sendResponse;
exports.makeResponseTest = makeResponse;
exports.setTimeOffsetTest = setTimeOffset;
exports.importRegionsTest = importRegions;
exports.parseRegionTest = parseRegion;
exports.setRegionTest = setRegion;
exports.assumeRoleTest = assumeRole;
exports.logInTest = logIn;
exports.resourceActivityTest = resourceActivity;
exports.validateUserPINTest = validateUserPIN;
exports.setAndSendPINTest = setAndSendPIN;
exports.generateRandomPINTest = generateRandomPIN;
exports.handleLogInToCloudTrailErrorsTest = handleLogInToCloudTrailErrors;
exports.redirectBasedOnMFATest = redirectBasedOnMFA;
