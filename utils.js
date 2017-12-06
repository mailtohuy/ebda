const 
	https = require('https'),
	http =  require('http'),
	fs = require('fs') ;

module.exports = {
	'send_http_request' : request_promise,
	'log' : write_log
};

function request_promise(host, method, port, endpoint, headers, payload) {
	return new Promise(function(resolve) {
		let options = {
			'host': host,
			'port': port || 80,
			'path': endpoint || '/',
			'method': method || 'GET',
			'headers': headers || {}
		};
    
		let protocol = ( port == 80 ) ? http : https;

		let req = protocol.request(options, function(res) {
			let data = [];
			res.on('data', (chunk) => data.push(chunk));
			res.on('end', () => {
				let success = {
					'request': `${method} ${endpoint}`,
					'status': res.statusCode, 
					'headers' : res.headers, 
					'data' : data.join('') 
				};
				// debugger;
				resolve( success );
			});
		});

		req.on('error', err =>{
			let failure = {
				'request': `${method} ${endpoint}`,
				'status' : 400,
				'headers': null,
				'error': err
			};
			// debugger;
			resolve( failure );
		});
		if (method != 'GET')
			req.write(payload);
		req.end();

	});
}

function write_log(level, content) {
	let text = content;
	if (typeof content === 'object') {
		text = JSON.stringify(content);
	}
	fs.appendFile('./eblog.txt', `\n[${level}] ${(new Date).toISOString()}\n${text}`, (err) => {
		if (err) throw err;
	});
}