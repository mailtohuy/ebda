const fs = require("fs");
const _ = require("underscore");
var	data_file = "./" + process.argv[2],
	data; // [ 'card#' : { card: card# , [x-auth-token|error]: ... , data: [ {resp 1}, {resp 2}] } ]

const marvel_eligible_cards = ['MXAVW', 'MXAVW', 'MXAPW', 'MXAPW', 'MCPLP', 'MCPLT', 'MCPLR'];	
	
	
	
if (process.argv[2] == undefined) {
	console.log('Enter a data file');
	process.exit();
	
} else {
	read_data(data_file)
	.then(transform_data)
	// .then(list_all_products)
	// .then(list_all_accounts)
	// .then(list_accounts_by_product_type)
	.then(find_clients_with_chequing)
	// .then(find_clients_with_savings)
	// .then(find_clients_for_tfsa_withdrawal)
	// .then(find_clients_for_payment_with_point)
	// .then(find_clients_with_loan) 
	// .then(find_clients_with_mortgage) 	
	// .then(find_clients_with_credit_card) 	
	// .then(find_clients_with_prepaid_visa)
	// .then(find_clients_with_plc)
	// .then(find_clients_with_usd_acct)
	// .then(find_small_business_clients)
	// .then(find_clients_not_registered_emt)
	.then(console.log);
}
/* TODO
1. Refactor other find_* functions to use find_clients_by_product? DONE
2. Find a way for all find_* functions to return the same data structure, so that I can do 
	read_data(file).then(transform_data)
	.then(find something)
	.then(find something from above results)
	.then(format final results)
	==> To do this, each function must check the structure of input before processing
*/

function find_clients_with_plc(data) {
	return find_clients_by_product(data, {type: 'PERSONAL_LINE_CREDIT'});		
}

function find_clients_with_prepaid_visa(data) {
	return find_clients_by_product(data, {type: 'PREPAID_CARD'});		
}

function find_clients_for_payment_with_point(data) {
	return marvel_eligible_cards
	.map( name=> { return { 'type': 'CREDIT_CARD', 'fullName': 'CARD' + name } })
	.reduce( (bin, product) => bin.concat(find_clients_by_product(data, product)), [] );
}

function find_clients_for_tfsa_withdrawal(data) {
	return find_clients_by_product(data, {registration: 'TFSA', type: 'SAVINGS'});		
}

function find_clients_with_loan(data) {
	/* Find clients that have loan accounts.
	Ex: registration: NON_REGISTERED, type: LOAN, code: CL, fullname: CLCL@ */
	return find_clients_by_product(data, {type: 'LOAN'});
}

function find_clients_with_mortgage(data) {
	/* Find clients that have mortgage accounts.
	Ex: registration: NON_REGISTERED, type: MORTGAGE, code: MTG, fullname: MTGMTG */
	return find_clients_by_product(data, {type: 'MORTGAGE'});	
}

function find_clients_with_credit_card(data) {	
	/* Find clients that have credit cards */
	return find_clients_by_product(data, {type: 'CREDIT_CARD'});
}

function find_clients_with_savings(data) {
	/* Find clients that have savings accounts */
	return find_clients_by_product(data, {type: 'SAVINGS'});
}

function find_clients_with_chequing(data) {
	/* Find clients that have chequing accounts */
	return find_clients_by_product(data, {type: 'CHEQUING'});
}

function find_clients_with_usd_acct(data) {
	/* Find clients that have USD accounts */
	return list_all_accounts(data)
	.filter(acct => acct.balance && acct.balance.currency == 'USD');	
}	

function find_clients_not_registered_emt(data) {
	/* Find cards that has not been registered for EMT */
	var emt_register = _.chain(data)
	.filter( card => _.contains(card.entitlements, 'EMT_REGISTER') )
	.pluck('card')
	.value()
	
	return emt_register;
}

function find_small_business_clients(data) {
	let cards = group_card_by_segments(data);
	return _.pick(cards, 'SMALL_BUSINESS_SIGNATORY', 'SMALL_BUSINESS_CO_SIGNATORY', 'SMALL_BUSINESS_DELEGATE', 'SMALL_BUSINESS_UNKNOWN');
}

function find_clients_by_product_2(all_accounts, this_product) {
	/* this is a memoized version of find_clients_by_product, 
	for use by list_accounts_by_product_type */
	return all_accounts.filter(acct => _.isMatch(acct.product, this_product));
}


function find_clients_by_product(data, this_product) {
	/* this_product must have at least one of {category, registration, type, code, fullName} */
	return list_all_accounts(data).filter(acct => _.isMatch(acct.product, this_product));
	/* Return:
		{ id: 'c487bd85d',
		  number: '6606947601',
		  nickname: '',
		  capabilities: [ 'RENAMEABLE', 'MARVEL_TO_ASR' ],
		  product: { category: 'CREDIT', registration: 'NON_REGISTERED', type: 'LOAN', code: 'CL', name: 'CL', fullName: 'CLCL@', bankDesignation: null },
		  availableFunds: { currency: 'CAD', amount: 6737.06 },
		  balance: { currency: 'CAD', amount: 6737.06 },
		  transit: '00002',
		  status: 'ACTIVE',
		  details: null,
		  accessCard: '4506445090048743',
		  clientSegment: 'PERSONAL_BANKING' 
		  // _type: 'InternalAccount',		  
		  // external: false,
		  // displayAttributes: null,		  
		}	
	*/	
}

function list_accounts_by_product_type(data) {
	// console.time('list_accounts_by_product_type');
	
	let products = list_all_products(data);
	
	let product_labels = products.map(t=>_.values(t).join("|"));
	
	let all_accounts = list_all_accounts(data);
	
	let accounts_by_product = products.map(product => find_clients_by_product_2(all_accounts, product));
	
	let output = _.object(product_labels, accounts_by_product);
	
	// console.timeEnd('list_accounts_by_product_type');
	
	return output;
}

function list_all_products(data) {	
	/* List all products that the clients in the data set have */
	let all_types = _.chain(data)
		.map( card => card.accounts.map(account => account.product) )
		.flatten()
		.value();
	
	/* filter out duplicate products */
	return all_types.reduce(
		function (unique_types, type){
			if (_.every(unique_types, ut =>_.isMatch(ut,type) == false))
				unique_types.push(type);
			return unique_types;
		}, []);
}

function list_all_accounts(data) {
	/* List all accounts. This contains duplicates in cases of 2 access cards sharing the same accounts */
	let accounts = _.chain(data)
	.map( card => _.chain(card.accounts)
					.map(account => _.defaults(account, {'accessCard' : card.card, 'clientSegment' : card.segment }))
					.value() )
	.flatten()
	.map(account => _.chain(account)
					.omit('_type', 'external', 'displayAttributes')
					.value())
	// .groupBy('card')
	.value();
	return accounts;	
}

function list_account_capabilities(data) {
	/* List all account capabilities */
	var capabilities = _.chain(data)
	.map(card => card.accounts)
	.flatten()
	.map(account => account.capabilities)
	.flatten()
	.uniq()
	.value();
	return capabilities;	
}

function list_client_features(data) {
	/* List all client features */
	var clientFeatures = _.chain(data)
	.map(card => card.clientFeatures)
	.flatten()
	.uniq()
	.value();
	
	return clientFeatures;
}

function list_client_entitlements(data) {
	/* List all client entitlements */
	var entitlements = _.chain(data)
	.map(card => card.entitlements)
	.flatten()
	.uniq()
	.value();
	
	return entitlements;
}

function list_cards_and_segments(data) {
	var card_segments = _.chain(data)
	.map(i => _.values(_.pick(i, 'card', 'segment')))
	.value();	
	return card_segments;
}

function group_card_by_segments(data) {
	var card_by_types = _.chain(data)
	.map(i => _.pick(i, 'card', 'segment', 'environment'))
	.reduce(function(a, b){
		if (a[b.segment] == undefined) {
			a[b.segment] = [];
			// a['environment'] = b.environment;
		}
		a[b.segment].push(b.card);
		return a;
	}, {})
	.value();
	return card_by_types;	
} 

function read_data(data_file) {
	return (new Promise((resolve, reject)=>{
		fs.readFile(data_file, "utf8",(error, content)=>{
			if (error) {
				console.log(error);
				reject({});
			} else {
				resolve(content);
			}
		});	
	}));
}

function transform_data(data) {
	return (new Promise((resolve, reject)=>{
		var json = JSON.parse(data);
		var good_cards = _.chain(json)
		.values() /* keep only values */
		.reject( item => _.has(item, "error") ) /* remove items with error */
		.map(item =>
			_.chain(item)
			.pick('card', 'environment', 'local-datetime') /* merge these 3 keys ... */
			.extend( 
				_.chain(item['data']) /* ... with the 'data' key */
				.map(i=>JSON.parse(i)) /* after parsing & merging the items in 'data' */
				.reduce((a,b)=>_.extend(a,b), {})
				.omit('meta', 'lastSignOn', 'cciRequired') /* and removing these keys */
				.value()
			)
			.value()
		)
		.value();	
		
		var bad_cards = _.chain(json)
		.values() /* keep only values */
		.filter( item => _.has(item, "error") )
		.pluck('card')
		.value();
		
		console.log("Good cards: %d, Bad cards: %d", good_cards.length, bad_cards.length);
		// console.log("Bad cards:\n%s", bad_cards.join('\n'));
		
		resolve(good_cards);
		
		/* Returns: 
			{ card: '...' 
			, environment: '...'
			, 'local-datetime': '...'
			, clientFeatures: [...]
			, entitlements: [...]
			, segment: '...'
			, accounts: [ 
				{ id
				, transit			
				, number
				, status
				, nickname
				, capabilities
				, _type // always 'InternalAcount'
				, product: 
					{ category 
					, registration
					, type
					, code
					, name
					, fullName
					, bankDesignation
					}
				, availableFunds:
					{ currency
					, amount
					}
				, details
				, displayAttributes
				, external
				} ]
			} 
		*/		
	}));
}