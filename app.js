const
	fs = require('fs'),
	path = require('path'),
	inquirer = require('inquirer'),
	_ = require('lodash'),
	finder = require('./analyze');

const exit_commands =	['q', 'quit', 'exit'];
const help_commands = ['l', 'list', 'h', 'help'];
const find_commands = _.chain(finder).keys().pull('load_from_raw_data', 'load_from_file').value();
const valid_commands = _.concat(find_commands, exit_commands, help_commands);
const DATA_DIR = './data';
var data_file = undefined;

const questions = [
	{
		type: 'list',
		name: 'data_file',
		message: 'Data file:',
		choices() {
			let all_files = fs.readdirSync(DATA_DIR);
			let json_files = _.chain(all_files)
				.filter(file => file.startsWith('sit') && file.endsWith('.json'))
				.map(file => file.replace(/\.json/,'') )
				.value();
			return json_files;
		},
		when() {
			return (data_file == undefined);
		},
		filter(answer) {
			return new Promise((resolve)=>{
				data_file = answer;
				finder.load_from_file(path.resolve(DATA_DIR, data_file + '.json'));
				resolve(answer);
			});
		}
	},
	{
		type: 'input',
		name: 'command',
		message: 'Command [q to quit]:',
		when() {
			return (data_file != undefined);
		},
		filter(answer) {
			return new Promise((resolve, reject) => {
				let cmd = answer.replace(/ /g, '_');
				if ( (_.indexOf(valid_commands, cmd) < 0) 
					|| (_.indexOf(help_commands, cmd) >= 0) ) {
					reject('Valid commands: ' + valid_commands.join(' | '));
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