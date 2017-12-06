const
	_ = require('lodash'),
	utils = require('./utils');

module.exports = {
	'signOn': signOn,
	'getAccounts': getAccounts,
	'signOff': signOff,
	'getUserProfile' : getUserProfile,
	'getBillPayees' : getBillPayees,
	'getDirectDepositRegistrations' : getDirectDepositRegistrations
};

function __extractErrorMessage(error_obj) {
	var message;

	if (error_obj['problems']) {
		message = error_obj['problems']
			.map(p => p.code + (p.details.message ? ' ' + p.details.message : ''))
			.reduce((a, b) => a + ',' + b);
	} else if (error_obj['transactionId']) {
		message = 'needs OTVC';
	} else if (error_obj['pvqs']) {
		message = 'needs PVQ';
	} else {
		message = JSON.stringify(_.values(error_obj) );
	}

	return message;
}

function send_ebanking_request(command, endpoint, headers, data, session) {
	/**
	 * environment: 'sit7', 'dit20'
	 * command: 'GET', 'POST', 'DELETE', 'PUT'
	 * data: {}
	 * session: { 'card': 1234567890123456, 'environment': 'sit7' }
	 */
	if (session['card'] == undefined || session['environment'] == undefined) {
		console.log('ebanking.js.send(): session uninitialized');
		return session;
	}

	let
		isSimplii = session['card'].startsWith('6'),
		__data = (typeof data === 'object') ? JSON.stringify(data) : '',
		host = session['environment'] + (isSimplii ? '.online.simplii.com' : '.cibconline.ebank.cibc.com');

	// default header fields
	let __headers = {
		'Content-Type': 'application/json',
		'Accept': 'application/json',
		'brand': isSimplii ? 'pcf' : 'cibc',
		'Client-Type': 'MOBILE_IPHONE'
		// 'Content-Length': Buffer.byteLength(__data)
	};

	// copy the parameter 'headers' into _headers
	_.chain(headers).keys().each(key => {
		__headers[key] = headers[key];
	}).value();

	if (session['x-auth-token']) {
		__headers['x-auth-token'] = session['x-auth-token'];
	}
	
	// send request and try to transform the response into JSON
	// debugger;
	utils.log('REQUEST', {'host':host, 'command': command, 'endpoint': endpoint, 'headers': __headers, 'payload' : __data});
	return utils.send_http_request(host, command, 443, endpoint, __headers, __data)
		.then(response => {

			/* if the request has response from ebanking server */
			if (response['data'] != undefined) {
				utils.log('RESPONSE', response);
				try {
					response.data = JSON.parse(response.data);
				} catch (err) {
					//likely because response is HTML (status 404) or is empty (status 204)
					response.data = { 'code' : response.status, 'message' : response.data }; 
					// console.log('send_ebanking_request: JSON parse error: ', response); 
				}
			}

			return response;
		});
}

function signOn(session) {
	/**
	 * session : e.g. { 'card': 1234567890123456, 'environment': 'sit7' }
	 */
	//TODO: add a check for card and environment in session
	let post_data = {
		card: {
			value: session['card'],
			encrypted: false,
			encrypt: false
		},
		password: 'banking'
	};

	let post_headers = {
		'WWW-Authenticate': 'CardAndPassword'
	};
	utils.log('-----------------------------------------SESSION START-----------------------------------------', '');
	return send_ebanking_request('POST', '/ebm-anp/api/v1/json/sessions', post_headers, post_data, session)
		.then(response => {
			debugger;

			session['local-datetime'] = response.headers['date'];

			if (response.status > 400) {
				session['error'] = __extractErrorMessage(response.data);
				return session;
			}

			if (response.status == 200) {
				/* process the server response headers */
				session['x-auth-token'] = response.headers['x-auth-token'];

				/* process the server response data */
				let client_info = response.data;
				session['clientFeatures'] = client_info['clientFeatures'];
				session['entitlements'] = client_info['entitlements'];
				session['segment'] = client_info['segment'];
				return session;
			}
		});
}

function getAccounts(session) {
	if (session['x-auth-token'] == undefined) {
		// console.log('getAccounts - no x-auth-token');
		return session;
	}

	return send_ebanking_request('GET', '/ebm-ai/api/v1/json/accounts', {}, '', session)
		.then(response => {

			if (response.status != 200) {
				console.log('getAccount error: ', response);
				return session;
			}

			/* process the server response data */
			// copy the account info into the session
			if (response.status == 200) {
				try {
					session['accounts'] = response.data['accounts'];
				} catch (error) {
					console.log('getAccounts error: no account in response');
				}
			}

			return session;
		});

}

function signOff(session) {
	if (session['x-auth-token'] == undefined) {
		// console.log('SignOff - no x-auth-token');
		return session;
	}
	return send_ebanking_request('DELETE', '/ebm-anp/api/v1/json/sessions', {}, '', session)
		.then(response =>{
			if (response.status != 204) {
				console.log('signOff - unexpected response');
			}
			return session;
		});
}

function getUserProfile(session) {
	if (session['x-auth-token'] == undefined) {
		return session;
	}

	return send_ebanking_request('GET', '/ebm-anp/api/v1/profile/json/userProfiles', {}, '', session)
		.then(response => {

			if (response.status != 200) {
				console.log(response);
			}			

			if (response.status == 200) {
				try {
					session['user'] = response.data;
				} catch (error) {
					//do something
				} 
			}
			return session;
		});
}

function getBillPayees(session) {
	if (session['x-auth-token'] == undefined) {
		// console.log('getBillPayees - no x-auth-token');
		return session;
	}

	return send_ebanking_request('GET', '/ebm-mm/api/v1/json/payees', {}, '', session)
		.then(response => {

			if (response.status != 200) {
				console.log(response);
			}

			if (response.status == 200) {
				try {
					session['payees'] = response.data['payees'];
				} catch (error) {
					//do something
				} 
			}
			return session;
		});
}

function getDirectDepositRegistrations(session) {
	if (session['x-auth-token'] == undefined) {
		return session;
	}

	return send_ebanking_request('GET', '/ebm-mm/api/v1.30/json/directDepositRegistrations', {}, '', session)
		.then(response => {

			if (response.status != 200) {
				//do something
			}			

			if (response.status == 200) {
				try {
					session['directDepositRegistrations'] = response.data['directDepositRegistrations'];
				} catch (error) {
					//do something
				} 
			}
			return session;
		});
}


// function getEMTRecipients(session) {
// 	if (session['x-auth-token'] == undefined) {
// 		return session;
// 	}

// 	return send_ebanking_request('GET', 'ebm-mm/api/v1/json/recipients', {}, '', session)
// 		.then(response => {

// 			if (response.status != 200) {
// 				//do something
// 			}

// 			if (response.status == 200) {
// 				try {
// 					session['recipients'] = response.data;
// 				} catch (error) {
// 					//do something
// 				} 
// 			}
// 			return session;
// 		});
// }

// function getEMTProfiles(session) {
// 	if (session['x-auth-token'] == undefined) {
// 		return session;
// 	}

// 	return send_ebanking_request('GET', 'ebm-mm/api/v1.30/json/emtProfiles', {}, '', session)
// 		.then(response => {

// 			if (response.status != 200) {
// 				console.log(session['x-auth-token']);
// 				console.log(response);
// 			}			

// 			if (response.status == 200) {
// 				try {
// 					session['emtProfiles'] = response.data;
// 				} catch (error) {
// 					//do something
// 				} 
// 			}
// 			return session;
// 		});
// }

// function getAccountTransactionHistory(accountId, fromDate, toDate, session) {
// 	/* check prerequisite */
// 	if (session['accounts'] == undefined) {
// 		// console.log('getAccountTransactionHistory - session has no account');
// 		return session;
// 	}

// 	let endpoint = `/ebm-ai/api/v1/json/transactions?accountId=${accountId}&fromDate=${fromDate}&toDate=${toDate}&limit=100&offset=0`;
// 	/* send ebanking request */
// 	return send_ebanking_request('GET', endpoint, {}, '', session)
// 		.then(response => {
// 			/* process response, report error or add stuff to session */
// 			//do stuff
// 			/* lastly, must return session so the then() chain is not broken */
// 			return session;
// 		});
// }
