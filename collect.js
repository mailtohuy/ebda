const
	eb = require('./ebanking'),
	_ = require('lodash'),
	fs = require('fs');


if ((process.argv[2] == undefined) || (process.argv[3] == undefined)) {
	console.log('node collect.js <card_file> <environment>\n');
	process.exit();

} else {
	var
		card_file = process.argv[2],
		environment = process.argv[3],
		file_name = './' + environment + '_' + ((new Date).toLocaleString().replace(/[\/,: ]/ig, '_')) + '.json';

	read_cards(card_file)
		.then(fetch_data)
		.then(data => save_to_file(file_name, JSON.stringify(data)));
}

function __extractErrorMessage(error_obj) {
	var message;

	if (error_obj['problems']) {
		message = error_obj['problems']
			.map(p => p.code + (p.details.message ? ' ' + p.details.message : ''))
			.reduce((a, b) => a + ',' + b);
	} else if (error_obj['transactionId']) {
		message = 'needs OTVC';
	} else {
		message = JSON.stringify(error_obj);
	}

	return message;
}

function __signOnAndGetAccounts(environment, card, session_data) {

	return eb.signOn(environment, card, session_data)
		.then(eb.getAccounts)
		.then(eb.signOff)
		.then(session_data => {
			console.log('%s: done!', session_data['card']);
			return session_data;
		})
		.catch(function (session_data) {
			var error = JSON.parse(session_data['error']),
				message = __extractErrorMessage(error);
			console.log('%s: %s!', session_data['card'], message);
		});
}

function fetch_data(cards) {
	// console.time('fetch_data');
	var sessions = {};

	/* initialize the sessions */
	cards.map(card => sessions[card] = {
		'card': card
	});

	/* run sequentially -> no 0001 errors */
	return cards.map(card => () => __signOnAndGetAccounts(environment, card, sessions[card]))
		.reduce(
			(resultBin, aRequest) =>
				resultBin.then(result => aRequest().then(Array.prototype.concat.bind(result))), Promise.resolve([])
		).then(__ignored => {
			// console.timeEnd('fetch_data');
			return sessions; // { <card1#> : <data1>, <card2#> : <data2>}		
		});
}

function save_to_file(file_name, data) {
	return new Promise((resolve, reject) => {
		fs.writeFile(file_name, data, (err) => {
			if (err) reject(err);
			resolve(file_name);
		});
	});
}

function read_cards(data_file) {
	return (new Promise((resolve, reject) => {
		var cards = [];
		fs.readFile(data_file, 'utf8', (error, content) => {
			if (error) {
				// console.log(error);
				reject(error);
			} else {

				cards = _.chain(content.split('\r\n'))
					.map(chunk => chunk.split('\n'))
					.flatten()
					.map(chunk => chunk.trim())
					.reject(chunk => (chunk.length == 0) || (chunk.startsWith('/')))
					.uniq()
					.value();
				resolve(cards);
			}
		});
	}));
}

module.exports = {
	'read_cards': read_cards,
	'fetch_data': fetch_data
};