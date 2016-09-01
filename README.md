# GitHub ReadMe for Alexa Integration with AWS CloudTrail

**How does the Alexa integration with AWS CloudTrail work?**

The Alexa integration with AWS CloudTrail uses Alexa-enabled devices and AWS Lambda to access API activity history from an AWS account. You speak to Alexa using an Alexa-enabled device, such as the Amazon Echo, to perform CloudTrail look up requests. For example, you can ask Alexa how many events occurred within a timeframe or ask about the recent activity for a user. You can also ask Alexa to send the results to specified email addresses.

**Overview:**

1. Create an IAM role with the necessary permissions to use Alexa.
2. Create an AWS Lambda function that hosts the code.
3. Create an Amazon Developer account and create an Alexa skill that points to your AWS Lambda function.
4. Configure the Lambda function to include your AWS account information.

You can look up, create, delete, and update API events for the last seven days. For a list of supported services and APIs, see: [Viewing Events with CloudTrail API Activity History](http://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events.html).

**Note**: This app supports looking up trails for the following attributes: event name, resource name, resource type, and user name. This app doesn't support event ID.

## Getting Started

**Option One** – If your CloudTrail trails and Lambda function belong to the same AWS account, follow step one. In step one, use the AWS CloudFormation template to create the IAM role and Lambda function. You can skip steps two and three.

**Option Two** – If your CloudTrail trails and Lambda function belong to separate AWS accounts, skip step one. In steps two and three, you manually create the IAM role and Lambda function.

### Step One - Deploying a CloudFormation Stack

1. Download the code from GitHub as a .zip file at [AWS CloudTrail Alexa](https://github.com/awslabs/aws-cloudtrail-alexa). The file contains templates that you use for each procedure.
2. Unzip the file to locate the *AlexaCloudTrailDesignTemplate* file.
3. Sign in to the AWS Management Console for the AWS account that will host the Lambda function.
4. In the navigation bar, choose **US East (N. Virginia)**.
5. From **Management**, choose **CloudFormation**.
6. Choose **Design Template**.
7. From the toolbar, choose the file icon and choose **Open**.
8. Choose **Local file** and upload the *AlexaCloudTrailDesignTemplate*.
9. From the toolbar, choose the icon for **Create stack**.
10. Choose **Next**.
11. Type a name for your stack, such as "AlexaCloudTrail", and then choose **Next**.
12. For **Options**, choose **Next**.
13. For **Capabilities**, select the **I acknowledge that AWS CloudFormation might create IAM resources**  **box.**
14. Review your changes and then choose **Create**.
15. Your Lambda function will be in the form of "stackname-AlexaIntegrationWithCloudTrail-randomID". Your IAM role will be in the form of "AlexaCloudTrail-ExecuteAlexaIntegrationWithCloudTrail-randomID".
16. Once your Lambda function is created, go to Lambda and click on the function just created.
17. Click on the **Triggers** tab, click **Add trigger**, and select "Alexa Skills Kit"

### Step Two – Creating the IAM Role

In this procedure, you create an IAM role with an external ID. The external ID serves as a password for the Alexa skill to assume the role. If you don't create an IAM role, your Alexa skill can only read trails that belong to an AWS account that also hosts the Lambda function.

1. Sign in to the AWS Management Console for the AWS account that has the CloudTrail trails that you want to look up.
2. From **Security & Identity**, choose **Identity & Access Management**.
3. In the navigation pane, choose **Roles**, and then choose **Create New Role**.
4. For **Role Name**, type "AlexaCloudTrail", and then choose **Next Step**.
5. For **Select Role Type**, choose **Role for Cross-Account Access**, and then choose **Select** next to **Allows IAM users from a 3rd party AWS account to access this account**.
6. For **Account ID**, type the account number of the AWS account that hosts the Lambda function.
7. For **External ID**, type an ID to serve as the password for the Alexa skill to read the trails that belong to this account.
8. Choose **Next Step**.
9. On the **Attach Policy** page, find and choose each of the following policies: AWSCloudTrailReadOnlyAccess, AmazonSESFullAccess\*, and AmazonSNSFullAccess.\*\*
10. Choose **Next Step**.
11. Review the information for the role you are about to create.
12.  Choose **Create Role**.

\* AmazonSESFullAccess is required only if you want your Alexa skill to send emails.

\*\* AmazonSNSFullAccess is required only if you want to use multi-factor authorization (MFA) with a random PIN.

### Step Three – Creating the Lambda Function

Create a Lambda function that hosts the code. When you ask Alexa a question, (for example, "What has Bob been up to?"), the Alexa skill triggers the Lambda function.

1. Sign in to the AWS Management Console for the AWS account that will host the Lambda function.
2. In the navigation bar, choose **US East (N. Virginia)**.
3. From **Compute**, choose **Lambda**.
    - If you are new to Lambda, choose **Get Started Now**.
    - If you have created a Lambda function before, choose **Create a Lambda function**.
4. On the **Select blueprint** page, choose **Skip**.
5. Configure a trigger, which is the service that invokes the Lambda function. Click the gray box next to the Lambda logo, and then choose **Alexa Skills Kit**.
6. Choose **Next**.
7. On the **Configure function** page, type your function name and description (for example, "AlexaCloudTrail").
8. For **Runtime**, choose Node.js 4.3.
9. For **Code entry type**, skip this step for now.
10. For **Role**:
    - Choose **Create a custom role**.
    - For **IAM Role**, choose **Create a new IAM Role**, and type a name if desired.
    - Click **View Policy Document** and then choose **Edit**.
    - When prompted, choose **Ok**.
    - For **Policy Document**, replace the default policy with the following, replacing the "ACCOUNTNUMBER" with the AWS account number that has the trails you want to read:

 ```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Effect": "Allow",
            "Action": "sts:AssumeRole",
            "Resource": "arn:aws:iam::ACCOUNTNUMBER:role/AlexaCloudTrail"
        }
    ]
}
```

11. Choose **Allow**.
12. For **Timeout**, enter 1 minute and then choose **Next**.
13. Review the information for the function that you are about to create.
14. Choose **Create function**.

### Step Four – Creating the Alexa Skill

After you create the Lambda function, create an Alexa skill and then specify your Lambda function so that the app can invoke your function.

1. Go to the [Amazon Developer Portal](https://developer.amazon.com/edw/home.html#/) and create an account.
2. On the menu, choose **Alexa**.
3. For **Alexa Skills Kit**, choose **Get Started**.
4. Choose **Add a New skill**.
5. For **Skill Type**, choose **Custom Interaction Model**.
6. Type the **Name** and **Invocation Name**. For **Invocation Name**, we recommend, "CloudTrail."
7. Choose **Next**.
8. For **Custom Slot Types**, choose **Add Slot Type**. Slot types that start with the AMAZON prefix are built-in and you don't need to add them. For more information, see: [Alexa Skills Kit Custom Interaction Model Reference](https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interaction-model-reference#h2_extend_types).
9. Add the type and then the list of values. For example, if the slot type is "LIST\_OF\_USERNAMES," then the values for this slot type are the IAM users that you want to look up. Add each value to a separate line.
10. Repeat steps 8 and 9 for each slot type. The slot types required for the skill are listed in the *Custom Slot Types* folder in the *Alexa Files* folder.
11. For **Intent Schema**, add the *IntentSchema.json* template file.
12. For **Sample Utterances**, add the *SampleUtterances.txt* template file.
13. Choose **Next**.
14. For **Endpoint**, choose **Lambda ARN (Amazon Resource Name)** and then type the ARN of your Lambda function. For example, "arn:aws:lambda:us-east-1:123456789012:function:AlexaCloudTrail".
15. For **Account Linking**, choose **No**, and then choose **Next**.
16. Choose **Enable testing**. The configuration for Alexa is complete.

### Step Five – Configuring the Lambda Function

After you create the Alexa skill, configure the Lambda function with your AWS account information.

1. Update the following variables in the index.js file for your Lambda function.
2. When you finish, re-zip the file.
3. Sign in to the AWS Management Console for the AWS account that hosts the Lambda function.
4. Choose **Lambda**.
5. Choose **Function**, and then choose the function that you created.
6. For **Code entry type**, choose **Upload a .Zip file**, and then choose **Upload**.
7. Choose the zip file and then choose **Save**.

You can now use this app with an Alexa device linked with the Amazon Developer account.

**Variables**:

**PHONE\_NUMBER** – The phone number that you want your one-time password to be sent to. This is required if you want to have one-time passwords (a random PIN) sent to your phone. You must include the country code (ex. '+1' for the United States)

**APP\_ID** \* – The application ID of your Alexa skill. You can find this value on the **Skill Information** page for your Alexa skill.

**ACCOUNT\_NUMBER** \* – Your 12-digit AWS account number that has the trails you want to look up. **Note**: Make this value null if the CloudTrail trails and the Lambda function belong to the same AWS account.

**EXTERNAL\_ID** \* – The external ID you specified in the role to look up the trails that belong to another AWS account. **Note**: Make this value null if the CloudTrail trails and the Lambda function belong to the same AWS account.

**USE\_MULTIFACTOR\_AUTHORIZATION** – A Boolean for using multi-factor authorization. The default is true. Set to false if the Lambda function doesn't use multi-factor authorization.

**PIN** – An optional hard-coded PIN. The default is null.

**recipientEmails** \*\* – An array of emails that you want Alexa to send emails to.

**sourceEmail** \*\* – The email that Alexa says the emails are from.

**eventNames** – The list of event names that you want to look up, such as ConsoleLogin, CreateBucket, and DeleteTrail.

**resourceTypes** – The list of resource types that you want to look up. The form should be "Servicename Resourcetype", such as "AutoScaling ScheduledAction", "IAM User", and "S3 Bucket". For a list of supported resource types, see [Resource Types Supported by CloudTrail API Activity History](http://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events-supported-resource-types.html).

**userNames** – The list of user names that you want to look up.

**resourceNames** – The list of resource names that you want to look up.

\*Required variables

\*\*Emails used must be verified on the AWS account that owns the CloudTrail trails that you want to look up. The emails are verified using Amazon Simple Email Service (Amazon SES). For more information, see [Verifying Email Addresses in Amazon SES](http://docs.aws.amazon.com/ses/latest/DeveloperGuide/verify-email-addresses.html).

After you update the variables for the Lambda function, you can use this app with an Alexa device linked with your Amazon Developer account.

## Creating a Custom Look up Function

You can create a custom function so that you can ask Alexa questions that are specific to your trail and AWS account. For example, you can create a custom function that looks up how many trails have been deleted since a specified date.

### Step One: Customizing the Alexa skill
1. Sign in to the Amazon Developer Portal and choose your Alexa CloudTrail skill. 
2. Choose **Interaction Model**.
3. For **Custom Slot Types**, choose **Add Slot Type**.
4. Enter the type that you specified in your intent schema. List each possible value that you expect for that slot type. Make sure each value is on its own line. For example, the type can be "LIST\_OF\_EVENT\_NAMES" and the values can be "CreateUser," or "ConsoleLogin".
5. Repeat steps 3 and 4 for each slot type in your intent schema.
6. For **Sample Utterance**, type the new command that you want to give Alexa. Make sure to give an intent name before the command and wrap each variable in braces {}.

    **Example:**
    
```
    LookupByEventName how many {EventName} happened {StartDate}
```

- LookupByEventName is the intent name.
- EventName and StartDate are variables for the command.
- "how many {EventName} happened {StartDate}" is the command spoken to Alexa.

7. For **Intent Schema**, create an intent for the utterance that you created. Alexa uses the intents to parse the input from the user.
 
    **Example:**
    
```
{
    "intent": "LookupByEventName",
    "slots": [
        {
            "name": "EventName",
            "type": "LIST_OF_EVENT_NAMES"
        },
        {
            "name": "StartDate",
            "type": "AMAZON.DATE"
        }
    ]
}
```

- The value next to intent is your intent name.
- Slots are each of the different variables specified in your utterance.
- Each slot has the name of the variable and a type.

**Note**: For custom slot types, you define the values that you expect for your given input. There are two different types of slot types: built-in and custom. For a list of built-in slot types, see: [Alexa Skills Kit Custom Interaction Model Reference](https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interaction-model-reference).
    
8. Verify your changes.
9. Choose **Next**.

### Step Two – Customizing the Lambda function

After you update the Alexa skill for your account, update the AWS Lambda function to include the values that you specified in the Alexa skill.

1. Open the index.js file in the Lambda code pulled from GitHub.
2. In "LookUpEventsSkill.prototype.intentHandlers", create an intent handler in the form of:

```
    "IntentName": **function** (intent, session, response) {
            lookup(intent,session,response,attributeKey,
                    attributeValue,outputGenerator,
                    startDate,endDate);
        },
```
Where:
- **IntentName** – Name specified for your Alexa intent.
- **intent** – Request sent by Alexa.
- **session** – Contains information about the current series of calls, including data passed in between calls.
- **response** – Object used to send a response to Alexa.
- **attributeKey** \* – The lookupAttribute. This can be a literal like "EventName" or a variable in the form of intent.intent.slots.VariableName.value.
- **attributeValue** \* – The lookupValue. This can be a literal like "ConsoleLogin" or a variable in the form of intent.intent.slots.VariableName.value.
- **outputGenerator** – Name of a function to generate your speech output.
- **startDate** and **endDate** – Date strings. This can be a literal such as "2016-07-29" or a variable in the form of intent.intent.slots.VariableName. The value can also be null.

\*attributeKey and attributeValue can have values or be null. However, if only one is defined, an error will occur.

3. Create your output generator function. An output generator function is a function that returns the speech that you want Alexa to read. A speechOutputGenerator function should accept the following variables, in the given order:
    - **Events** – An array of events returned by CloudTrail.
    - **attributeKey** – The attribute that you used for lookup, such as EventName, ResourceType, ResourceName, and Username.
    - **attributeValue** – Value that you want to match for your attributeKey, such as ConsoleLogin.
    - **userStartDate** and **userEndDate** – JSON objects in the form of:
```  
    {
        "Name": "StartDate",
        "Value": "dateString"
    }
```
After you enter these values, your custom lookup function is ready. Try your commands on your Alexa-enabled device.
