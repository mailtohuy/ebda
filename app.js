const
	fs = require('fs'),
	inquirer = require('inquirer'),
	_ = require('lodash'),
	finder = require('./analyze');

const exit_commands =	['q', 'quit', 'exit'];
const help_commands = ['l', 'list', 'h', 'help'];
const find_commands = _.chain(finder).keys().pull('init').value();
const valid_commands = _.concat(find_commands, exit_commands, help_commands);

var data_file = undefined;
var data = undefined;

const questions = [
	{
		type: 'list',
		name: 'from',
		message: 'Start with a list of cards or a data file?',
		choices: [ 'file', 'cards' ],
		default: 'file',
		when() {
			return (data == undefined);
		}
	},
	{
		type: 'editor',
		name: 'card_list',
		message: 'Enter your cards (one per line):',
		when(session) {
			return (data == undefined) && (session['from'] === 'cards');
		},
		filter(input) {
			return new Promise((resolve, reject) => {
				let cards = input.split('\r\n'); //todo: fix this
				if ( cards.length < 1 ) {
					reject('Please enter at least 1 card!');
				} else {
					resolve(cards);
				}
			});
		}
	},
	{
		type: 'list',
		name: 'data_file',
		message: 'Data file:',
		choices() {
			let all_files = fs.readdirSync('.');
			let json_files = _.chain(all_files)
				.filter(file => file.startsWith('sit') && file.endsWith('.json'))
				.value();
			return json_files;
		},
		when(session) {
			return (data == undefined) && (session['from'] === 'file');
		},
		filter(answer) {
			return new Promise((resolve)=>{
				data_file = answer;
				finder.load_from_file(data_file);
				resolve(answer);
			});
		}
	},
	{
		type: 'input',
		name: 'command',
		message: 'Command:',
		when() {
			return (data != undefined);
		},
		filter(answer) {
			return new Promise((resolve, reject) => {
				let cmd = answer.replace(/ /g, '_');
				if ( _.indexOf(valid_commands, cmd) < 0 ) {
					reject('Command not found!\nValid commands: ' + valid_commands.join(' | '));
				} else {
					resolve(cmd);
				}
			});
		}
	}
];

function executeCommand(session) {
	let cmd = session['command'];

	if ( exit_commands.indexOf( cmd ) >= 0) {
		return;
	}

	
	finder[cmd]()
		.then(console.log);

	return inquirer.prompt(questions).then(executeCommand);
}

inquirer.prompt(questions).then(executeCommand);