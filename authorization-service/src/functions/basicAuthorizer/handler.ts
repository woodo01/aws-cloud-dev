import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';

export const basicAuthorizer = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  console.log('Event: ', JSON.stringify(event));

  try {
    // Validate authorization token
    if (!event.authorizationToken) {
      console.log('Missing authorization token');
      return generatePolicy('unauthorized', 'Deny', event.methodArn);
    }

    const authParts = event.authorizationToken.split(' ');
    
    // Check if format is "Basic base64credentials"
    if (authParts.length !== 2 || authParts[0] !== 'Basic') {
      console.log('Invalid authorization header format');
      return generatePolicy('unauthorized', 'Deny', event.methodArn);
    }
    
    // Decode credentials
    let plainCredentials: string[];
    try {
      const buff = Buffer.from(authParts[1], 'base64');
      plainCredentials = buff.toString('utf-8').split(':');
      
      if (plainCredentials.length !== 2) {
        console.log('Invalid credentials format');
        return generatePolicy('unauthorized', 'Deny', event.methodArn);
      }
    } catch (error) {
      console.log('Failed to decode credentials:', error);
      return generatePolicy('unauthorized', 'Deny', event.methodArn);
    }
    
    const username = plainCredentials[0];
    const password = plainCredentials[1];

    // Don't log actual credentials in production
    console.log('Authentication attempt for username:', username);
    
    const storedPassword = process.env[username];
    
    // Use constant-time comparison to prevent timing attacks
    const effect = !storedPassword || !compareSecurely(password, storedPassword) 
      ? 'Deny' 
      : 'Allow';
    
    console.log('Authentication result:', effect);
    return generatePolicy(username, effect, event.methodArn);

  } catch (error) {
    console.error('Error during authorization:', error);
    return generatePolicy('error', 'Deny', event.methodArn);
  }
};

/**
 * Compares two strings in a way that prevents timing attacks
 */
const compareSecurely = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
};

/**
 * Generates an IAM policy document for API Gateway authorization
 */
const generatePolicy = (
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string
): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    }
  };
};
