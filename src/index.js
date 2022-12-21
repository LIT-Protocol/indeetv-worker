/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npx wrangler dev src/index.js` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npx wrangler publish src/index.js --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { verifyJwt } from "lit-jwt-verifier";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
};


let urlStub = 'https://api.indee.tv/cms/v1';

// note: original
export default {
  async fetch(request, env, ctx) {

    if (!!env.DEV) {
      urlStub = 'http://localhost:3000';
    }

    if (request.method === 'OPTIONS') {
      // Handle CORS preflight requests
      return handleOptions(request);
    }

    let resBody = 'no endpoint';

    const splitUrl = request.url.split('/');
    const callType = splitUrl.pop();

    if (callType === 'validate') {
      resBody = await validate(request, env);
    }
    if (callType === 'get-authorized-content') {
      resBody = await getContent(request, env);
    }

    return new Response(resBody, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS"
      }
    });
  }
};

function handleOptions(request) {
  // Make sure the necessary headers are present
  // for this to be a valid pre-flight request
  let headers = request.headers;
  if (
    headers.get('Origin') !== null &&
    headers.get('Access-Control-Request-Method') !== null &&
    headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Handle CORS pre-flight request.
    // If you want to check or reject the requested method + headers
    // you can do that here.
    let respHeaders = {
      ...corsHeaders,
      // Allow all future content Request headers to go back to browser
      // such as Authorization (Bearer) or X-Client-Name-Version
      'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers'),
    };

    return new Response(null, {
      headers: respHeaders,
    });
  } else {
    // Handle standard OPTIONS request.
    // If you want to allow other HTTP Methods, you can do that here.
    return new Response(null, {
      headers: {
        Allow: 'GET, HEAD, POST, OPTIONS',
      },
    });
  }
}

// returns body as string
async function gatherResponse(response) {
  const {headers} = response;
  const contentType = headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    console.log('gatherResponse - json')
    return JSON.stringify(await response.json());
  } else if (contentType.includes('application/text')) {
    console.log('gatherResponse - application/text')
    return response.text();
  } else if (contentType.includes('text/html')) {
    console.log('gatherResponse - text/html')
    return response.text();
  } else {
    console.log('gatherResponse - etc')
    return response.text();
  }
}

async function validate(request, env) {
  const body = await request.text();
  const parsedBody = JSON.parse(body);
  console.log('$$$$$$$ -> validate parsedBody', parsedBody);

  // verify access token
  try {
    const auth = await verifyJwt({jwt: parsedBody.litJwt});
    if (!auth.verified) {
      return 'Unauthorized';
    }
  } catch (err) {
    return 'Unauthorized';
  }

  const authString = `Bearer ${env.INDEE_API_KEY}`;
  const url = `${urlStub}/auth/validate`;

  console.log('$$$$$$$ -> validate authString', authString);

  const config = {
    body: JSON.stringify({
      type: "pin",
      credentials: {
        pin: parsedBody.pin
      }
    }),
    method: 'POST',
    headers: {
      'Authorization': authString,
      'content-type': 'application/json;charset=UTF-8',
    },
  };

  console.log('$$$$$$$ -> validate config', config);

  try {
    const res = await fetch(url, config);
    const parsedRes = await gatherResponse(res);
    // console.log('exit validate - parsedRes', parsedRes);
    return parsedRes;
  } catch (err) {
    return await gatherResponse(err);
  }
}

async function getContent(request, env) {
  const body = await request.text();
  console.log('get Content body', body);
  const parsedBody = JSON.parse(body);

  // verify access token
  try {
    const auth = await verifyJwt({jwt: parsedBody.litJwt});
    if (!auth.verified) {
      return 'Unauthorized';
    }
  } catch (err) {
    return 'Unauthorized';
  }

  console.log('parsedBody', parsedBody);

  const url = `${urlStub}/meta/get-authorized-content`;
  const config = {
    method: 'GET',
    headers: {
      'Authorization': `JWT ${parsedBody.indeeTvJwt}`
    },
  };
  const res = await fetch(url, config);
  return await gatherResponse(res);
}
