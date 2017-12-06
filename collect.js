const
	eb = require('./ebanking'),
	_ = require('lodash'),
	fs = require('fs');

module.exports = {
	'get': read_cards,
	'fetch_data': fetch_data
};	

if ((process.argv[2] == undefined) || (process.argv[3] == undefined)) {
	console.log('node collect.js <card_file> <environment>\n');
} else {
	var
		card_file = process.argv[2],
		environment = process.argv[3],
		file_name = './' + environment + '_' + ((new Date).toLocaleString().replace(/[\/,: ]/ig, '_')) + '.json';

	read_cards(card_file)
		.then(fetch_data)
		.then(data => save_to_file(file_name, JSON.stringify(data)));
}

function signOnAndGetAccounts(session) {

	return eb.signOn(session)
		.then(eb.getAccounts)
		.then(eb.getEMTRecipients)
		.then(eb.getBillPayees)
		.then(eb.signOff)
		.then(returned_session => {

			if (returned_session['error'] == undefined) {
				console.log('%s: done!', returned_session['card']);	
			} else {
				console.log('%s: %s', returned_session['card'], returned_session['error']);
			}

			return returned_session;
		});
}

function fetch_data(cards) {
	// console.time('fetch_data');
	var sessions = {};

	/* initialize the sessions */
	cards.map(card => sessions[card] = {
		'card': card,
		'environment' : environment
	});

	/* run sequentially -> no 0001 errors */
	return cards.map(card => () => signOnAndGetAccounts(sessions[card]))
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
				cards = _.chain(content.match(/([\/]{0,2}\d[ -]*){16}/g))
					.reject(card =>card.startsWith('/'))
					.map(card => card.replace(/[ -]/g, ''))
					.uniq()
					.value();
				resolve(cards);
			}
		});
	}));
}

