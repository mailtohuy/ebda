var fs = require("fs"),
	_ = require("underscore"),
	data_file = "./" + process.argv[2],
	data; // [ 'card#' : { card: card# , [x-auth-token|error]: ... , data: [ {resp 1}, {resp 2}] } ]

if (process.argv[2] == undefined) {
	console.log('Enter a data file');
	process.exit();
	
} else {
	read_data(data_file)
	.then(transform_data)
	// .then(list_all_products)	/* list all account types in the data set */
	.then(find_clients_for_payment_with_point)
	.then(console.log)
	;
}

function find_clients_for_payment_with_point(data) {
	const marvel_eligible_cards = ['MXAVW', 'MXAVW', 'MXAPW', 'MXAPW', 'MCPLP', 'MCPLT', 'MCPLR'].map(name=> 'CARD' + name) ;

	let marvel_cards = _.chain(data)
					.map( card => _.chain(card.accounts)
					.map(account => _.defaults(account, {'card' : card.card }))
					.value() )
					.flatten()
					.map(account => _.chain(account)
						.pick('id', 'card', 'status', 'transit', 'number', 'balance', 'availableFunds' , 'capabilities', 'product')
						.value())
					.filter(acct => acct.product.type === 'CREDIT_CARD' )
					.filter(acct => _.contains(marvel_eligible_cards, acct.product.fullName))
					.pluck('card')
					.uniq()
					.value();
	return marvel_cards;
}

function find_small_business_clients(data) {
	let cards = group_card_by_segments(data);
	return _.pick(cards, 'SMALL_BUSINESS_SIGNATORY', 'SMALL_BUSINESS_CO_SIGNATORY', 'SMALL_BUSINESS_DELEGATE', 'SMALL_BUSINESS_UNKNOWN');
}

function list_all_products(data) {	
	/* List all products that the clients in the data set have */
	var account_types = _.chain(data)
	.map( card => _.chain(card.accounts)
					.map(account => _.defaults(account, {'card' : card.card }))
					.value() )
	.flatten()
	.map(account => 
		_.chain(account)
		.defaults({'registration': account.product.registration, 'type': account.product.type, 'code': account.product.code, 'fullName' : account.product.fullName})
		.pick('registration', 'type', 'code', 'fullName')
		.values()
		.join(' ')
		.value())
	.uniq()
	.value();
	return account_types;
}

function find_clients_with_tfsa(data) {
	/* Find clients that have TFSA accounts.
	Ex: registration: TFSA, type: SAVINGS, code: TFSADISA, fullName: TFSATFSAD */
	var tfsa_accts = _.chain(data)
	.map( card => _.chain(card.accounts)
					.map(account => _.defaults(account, {'card' : card.card }))
					.value() )
	.flatten()
	.map(account => _.chain(account)
		.pick('id', 'card', 'status', 'transit', 'number', 'balance', 'availableFunds' , 'capabilities')
		.defaults({'registration': account.product.registration, 'type': account.product.type})
		.value())
	.filter(acct => acct.registration === 'TFSA')
	.map(acct => _.pick(acct, 'card', 'transit', 'number', 'type', 'balance'))	
	.groupBy('card')
	.value();
	return tfsa_accts;		
}

function find_clients_with_loan(data) {
	/* Find clients that have loan accounts.
	Ex: registration: NON_REGISTERED, type: LOAN, code: CL, fullname: CLCL@ */
	var mortgage_accts = _.chain(data)
	.map( card => _.chain(card.accounts)
					.map(account => _.defaults(account, {'card' : card.card }))
					.value() )
	.flatten()
	.map(account => _.chain(account)
		.pick('id', 'card', 'status', 'transit', 'number', 'balance', 'availableFunds' , 'capabilities')
		.defaults({'registration': account.product.registration, 'type': account.product.type})
		.value())
	.filter(acct => acct.type === 'LOAN')
	.map(acct => _.pick(acct, 'card', 'transit', 'number', 'type', 'balance'))	
	// .groupBy('card')
	.value();
	return mortgage_accts;		
}

function find_clients_with_mortgage(data) {
	/* Find clients that have mortgage accounts.
	Ex: registration: NON_REGISTERED, type: MORTGAGE, code: MTG, fullname: MTGMTG */
	var mortgage_accts = _.chain(data)
	.map( card => _.chain(card.accounts)
					.map(account => _.defaults(account, {'card' : card.card }))
					.value() )
	.flatten()
	.map(account => _.chain(account)
		.pick('id', 'card', 'status', 'transit', 'number', 'balance', 'availableFunds' , 'capabilities')
		.defaults({'registration': account.product.registration, 'type': account.product.type})
		.value())
	.filter(acct => acct.type === 'MORTGAGE')
	.map(acct => _.pick(acct, 'card', 'transit', 'number', 'type', 'balance'))	
	// .groupBy('card')
	.value();
	return mortgage_accts;	
}

function find_clients_with_credit_card(data) {	
	/* Find clients that have credit cards */
	var credit_cards = _.chain(data)
	.map( card => _.chain(card.accounts)
					.map(account => _.defaults(account, {'card' : card.card }))
					.value() )
	.flatten()
	.map(account => _.chain(account)
		.pick('id', 'card', 'status', 'transit', 'number', 'balance', 'availableFunds' , 'capabilities', 'product')
		// .defaults({'registration': account.product.registration, 'type': account.product.type})
		.value())
	// .filter( acct => acct.product.type.indexOf('CREDIT') >= 0 ) // matches CREDIT_CARD, PERSONAL_LINE_DREDIT, etc
	.filter(acct => acct.product.type === 'CREDIT_CARD' ) 
//	.map(acct => _.pick(acct, 'id', 'card', 'balance'))	
	.pluck('card')
	.uniq() /* an access card may be attached to multiple credit cards */
	.value();
	return credit_cards;
}

function find_clients_with_usd_acct(data) {
	/* Find clients that have USD accounts */
	var usd_accts = _.chain(data)
	.map( card => _.chain(card.accounts)
					.map(account => _.defaults(account, {'card' : card.card }))
					.value() )
	.flatten()
	.map(account => _.chain(account)
		.pick('id', 'card', 'status', 'transit', 'number', 'balance', 'availableFunds' , 'capabilities')
		.defaults({'registration': account.product.registration, 'type': account.product.type})
		.value())
	.filter(acct => acct.balance && acct.balance.currency == 'USD')
	.map(acct => _.pick(acct, 'card', 'transit', 'number', 'type', 'balance'))	
	// .groupBy('card')
	.value();
	return usd_accts;
}	

function list_accounts(data) {
	/* List all accounts */
	var accounts = _.chain(data)
	.map( card => _.chain(card.accounts)
					.map(account => _.defaults(account, {'card' : card.card }))
					.value() )
	.flatten()
	.map(account => _.chain(account)
		// .pick('id', 'card', 'status', 'transit', 'number', 'balance', 'availableFunds' , 'capabilities')
		.pick('card', 'transit', 'number', 'balance' , 'product')
		// .defaults({'registration': account.product.registration, 'type': account.product.type})
		.value())
	// .groupBy('card')
	.value();
	return accounts;	
}

function find_not_registered_emt(data) {
	/* Find cards that has not been registered for EMT */
	var emt_register = _.chain(data)
	.filter( card => _.contains(card.entitlements, 'EMT_REGISTER') )
	.pluck('card')
	.value()
	
	return emt_register;
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






