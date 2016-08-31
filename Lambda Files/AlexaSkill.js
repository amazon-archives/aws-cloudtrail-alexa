/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
        http://aws.amazon.com/apache2.0/
    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

'use strict';
var speechOutputs = require('./SpeechOutputs');
function AlexaSkill(appId) {
    this._appId = appId;
}

AlexaSkill.speechOutputType = {
    PLAIN_TEXT: 'PlainText',
    SSML: 'SSML'
};
/**
 * Handle the three different requests: Launch(for when the skill is "opened"), Intent(for any user commands) and SessionEnd(for when the skill is "closed").
 */
AlexaSkill.prototype.requestHandlers = {
    LaunchRequest: function (event, context, response) {
        this.eventHandlers.onLaunch.call(this, event.request, event.session, response);
    },

    IntentRequest: function (event, context, response) {
        this.eventHandlers.onIntent.call(this, event.request, event.session, response);
    },

    SessionEndedRequest: function (event, context) {
        this.eventHandlers.onSessionEnded(event.request, event.session);
        context.succeed();
    }
};

/**
 * Override any of the eventHandlers as needed
 */
AlexaSkill.prototype.eventHandlers = {
    /**
     * Called when the session starts.
     * Subclasses could have overridden this function to open any necessary resources.
     */
    onSessionStarted: function (sessionStartedRequest, session) {
    },

    /**
     * Called when the user invokes the skill without specifying what they want.
     * The subclass must override this function and provide feedback to the user.
     */
    onLaunch: function (launchRequest, session, response) {
        throw "onLaunch should be overriden by subclass";
    },

    /**
     * Called when the user specifies an intent.
     */
    onIntent: function (intentRequest, session, response) {
        var intentName = intentRequest.intent.name;
        var intentHandler;
        if(session.attributes.isUserPINValidated || intentName === "ValidatePIN" || 
                intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") { 
            /*Let the user do a function if the PIN has been set. Also, don't stop them from
            validating their PIN or closing the Skill*/
            intentHandler = this.intentHandlers[intentName];   
            console.log('dispatch intent = ' + intentName);
            intentHandler.call(this, intentRequest, session, response);
        } else {
            var speechText = speechOutputs.welcomeResponse.noPINSet;
            if(this.intentHandlers[intentName]) { //If it's a valid intent
                var repromptOutput = {
                        speech: speechOutputs.welcomeResponse.reprompt,
                        type: AlexaSkill.speechOutputType.PLAIN_TEXT
                };
                var speechOutputObject = {
                        speech: speechText,
                        type: AlexaSkill.speechOutputType.PLAIN_TEXT
                };
                response.askWithCard(response.mockResponse(speechOutputObject,repromptOutput,
                        "PIN not validated",speechText,session));
            } else {
                throw 'Unsupported intent = ' + intentName;  
            }
        }
    },

    /**
     * Called when the user ends the session.
     * Subclasses could have overridden this function to close any open resources.
     */
    onSessionEnded: function (sessionEndedRequest, session) {
    }
};

/**
 * Subclasses should override the intentHandlers with the functions to handle specific intents.
 */
AlexaSkill.prototype.intentHandlers = {};

AlexaSkill.prototype.execute = function (event, context) {
    try {
    	var eventString = JSON.stringify(event, null, 4);
    	console.log("event: " + eventString);

        // Validate that this request originated from authorized source.
        if (this._appId && event.session.application.applicationId !== this._appId) {
            console.log("The applicationIds don't match : " + event.session.application.applicationId + " and "
                + this._appId);
            throw "Invalid applicationId";
        }

        if (!event.session.attributes) {
            event.session.attributes = {};
        }

        if (event.session.new) {
            this.eventHandlers.onSessionStarted(event.request, event.session);
        }

        // Route the request to the proper handler which may have been overridden.
        var requestHandler = this.requestHandlers[event.request.type];
        requestHandler.call(this, event, context, new Response(context, event.session));
    } catch (e) {
        console.log("Unexpected exception " + e);
        context.fail(e);
    }
};

var Response = function (context, session) {
    this._context = context;
    this._session = session;
};
AlexaSkill.prototype.makeResponse = function(context, session) {
    return new Response(context,session);
}
/**
 * Creates a speech object for Alexa to parse
 */
function createSpeechObject(optionsParam) {
    if (optionsParam && optionsParam.type === 'SSML') {
        return {
            type: optionsParam.type,
            ssml: optionsParam.speech
        };
    } else {
        return {
            type: optionsParam.type || 'PlainText',
            text: optionsParam.speech || optionsParam
        };
    }
}

Response.prototype = (function () {
    var buildSpeechletResponse = function (options) {
        var alexaResponse = {
            outputSpeech: createSpeechObject(options.output),
            shouldEndSession: options.shouldEndSession
        };
        if (options.reprompt) {
            alexaResponse.reprompt = {
                outputSpeech: createSpeechObject(options.reprompt)
            };
        }
        if (options.cardTitle && options.cardContent) {
            alexaResponse.card = {
                type: "Simple",
                title: options.cardTitle,
                content: options.cardContent
            };
        }
        var returnResult = {
                version: '1.0',
                response: alexaResponse
        };
        if (options.session && options.session.attributes) {
            returnResult.sessionAttributes = options.session.attributes;
        }
        return returnResult;
    };
    var makeResponse = function (speechOutput, repromptSpeech, cardTitle, cardContent,session) {
        return buildSpeechletResponse({
            session: session,
            output: speechOutput,
            reprompt: repromptSpeech,
            cardTitle: cardTitle,
            cardContent: cardContent,
            shouldEndSession: false
        });
    }

    return {
        tell: function (speechOutput) {
            this._context.succeed(buildSpeechletResponse({
                session: this._session,
                output: speechOutput,
                shouldEndSession: true
            }));
        },
        tellWithCard: function (speechOutput, cardTitle, cardContent) {
            this._context.succeed(buildSpeechletResponse({
                session: this._session,
                output: speechOutput,
                cardTitle: cardTitle,
                cardContent: cardContent,
                shouldEndSession: true
            }));
        },
        ask: function (speechOutput, repromptSpeech, session) {
            this._context.succeed(buildSpeechletResponse({
                session: session,
                output: speechOutput,
                reprompt: repromptSpeech,
                shouldEndSession: false
            }));
        },
        askWithCard: function (file) {
            this._context.succeed(file);
        },
        mockResponse: function (speechOutput, repromptSpeech, cardTitle, cardContent,response, session) {
            return makeResponse(speechOutput, repromptSpeech, cardTitle, cardContent,session);
        }
    };
})();

module.exports = AlexaSkill;