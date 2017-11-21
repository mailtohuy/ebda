const http = require('https');

function send(environment, command, endpoint, headers, data, session_data){
	return new Promise((resolve, reject) => {
		var post_headers = {
		'Content-Type': 'application/json; charset=UTF-8',
		'Content-Length': Buffer.byteLength(data),
		};

		// copy headers into post_headers
		Object.keys(headers).forEach(function(key) {
			post_headers[key] = headers[key];  
		});
		
		// copy x-auth-token from session_data into request headers
		if (session_data['x-auth-token'] != undefined) {
			post_headers['x-auth-token'] = session_data['x-auth-token'] ; 
		}

		// save environment to session_data
		if (session_data['environment'] == undefined) {
			session_data['environment'] = environment ; 
		}		

		var post_options = {
		  //host: environment + '.simplii.online.com',
		  host: environment + '.cibconline.ebank.cibc.com',
		  port: '443',
		  path: endpoint,
		  method: command,
		  headers: post_headers
		};

		// Set up the request
		const body = [];
		var req = http.request(post_options, function(response) {
			response.setEncoding('utf8');			
			response.on('data', (chunk) => body.push(chunk));
			response.on('end', 
				function () {
					// add all data together
					response_data = body.join('');
					
					// save x-auth-token to session_data
					if (response.headers['x-auth-token'] != undefined) {
						session_data['x-auth-token'] = response.headers['x-auth-token'];
					}
					
					// save local-datetime to session_data
					if (response.headers['local-datetime'] != undefined) { 
						session_data['local-datetime'] = response.headers['local-datetime']
					}
				
					// initiate session_data['data']
					if (session_data['data'] == undefined) {
						session_data['data'] = [];
					}
					
					// check response status code
					if (response.statusCode < 200 || response.statusCode > 299) {
		
						//TODO: handle OTVC
						
						// save the error to session data
						session_data['error'] = response_data; 
						
						reject(session_data);
						
					} else {
						
						// save the response data to session_data
						if (response_data.length > 0) {
							session_data['data'].push( response_data );							
						}	

						resolve(session_data);
					}
				}
			);
		});

		// post the data
		if ( data == undefined || command != "POST" ) {
			data = "";
		}
		
		var start = (new Date()).getTime();
		setTimeout(function() {
			req.write(data);
			req.end();
			session_data['time'] = (new Date()).getTime() - start;
		}
		, Math.round(Math.random()*1000));
	});
}

function signOn(environment, cardnumber, session_data) {
	var post_data = JSON.stringify({
	   card:{
		  value: cardnumber,
		  encrypted: false,
		  encrypt: false
	   },
	   password: 'banking'
	});
	
	var post_headers = {
		'WWW-Authenticate': 'CardAndPassword',
		'brand': 'cibc',
		'client_type': 'default_web'
	} ;
	
	// add card number to session data
	session_data['card'] = cardnumber;
	return send(environment, "POST", '/ebm-anp/api/v1/json/sessions', post_headers, post_data, session_data);
}

function getAccounts(session_data) {
	return send(session_data.environment, "GET", "/ebm-ai/api/v1/json/accounts", {},"", session_data);
}

function signOff(session_data) {
	return send(session_data.environment, "DELETE", "/ebm-anp/api/v1/json/sessions", {},"", session_data);
}

module.exports = {
  signOn: signOn,
  getAccounts: getAccounts,
  signOff: signOff
}
