const 
	fs = require('fs'),
	_ = require('lodash');
  
var	data_bank; // A Promise: [ 'card#' : { card: card# , [x-auth-token|error]: ... , data: [ {resp 1}, {resp 2}] } ]

// load_from_file('./data/sit28_cibc.json').then(find_accounts_plc).then(console.log);

module.exports =
{  
	'load_from_raw_data' : load_from_raw_data,
	'load_from_file': load_from_file,
	'cheq' : find_accounts_chequing,
	'sav' : find_accounts_savings,
	'tfsa' : find_accounts_for_tfsa_withdrawal,
	'aventura' : find_accounts_for_payment_with_point,
	'loan': find_accounts_loan,
	'mortgage': find_accounts_mortgage,
	'credit' : find_accounts_credit_card,
	'prepaid': find_accounts_prepaid_visa,
	'plc' : find_accounts_plc,
	'usd' : find_accounts_usd,
	'usd_visa' : find_accounts_usd_visa,
	'sbs' : find_clients_small_business_signatory,
	'sbc' : find_clients_small_business_cosignatory,	
	'sbd' : find_clients_small_business_delegate,	
	'sbu' : find_clients_small_business_unknown,			
	'pb' : find_clients_personal_banking ,
	'pwm' : find_clients_private_wealth ,
	'is' : find_clients_imperial_service ,
	'cco' : find_clients_credit_only ,
	'non_emt' : find_clients_not_registered_emt,
	'emt' : find_clients_registered_emt
};

function __prettyPrintAccount(accounts) {
	/*
	 * accounts -> [ { ...  }, {  } ] 
	 * Output -> [ [ transit/account, accessCard, balance ], {  } ]
	 */
	return _.chain(accounts)
		.map(acct => { 
			let 
				number = (acct.transit ? acct.transit + ' / ' : '') + acct.number,
				balance = acct.balance && acct.balance.currency && acct.balance.amount ? `${acct.balance.amount} ${acct.balance.currency}` : 'no balance' ;

			let copy = { };
			copy.accountWithBalance = `${number} (${balance})`;
			copy.accessCard = acct.accessCard;
			return copy;
		})
		.groupBy('accountWithBalance')
		.map((g,k) => [k, _.chain(g).map(a=>a.accessCard).uniq().value() ])
		.fromPairs()
		.value();
}

function load_from_raw_data(raw_data) {
	return transform_data(raw_data).then(transformed_data => {
		data_bank = Promise.resolve(transformed_data);
		return data_bank;
	});
}

function load_from_file(path_to_data_file) {
	return read_data(path_to_data_file).then(transform_data).then(transformed_data => {
		data_bank = Promise.resolve(transformed_data);
		return data_bank;
	});
}
       
/* TODO
1. Refactor other find_* functions to use find_accounts_by_product? DONE
2. Find a way for all find_* functions to return the same data structure, so that I can do 
  read_data(file).then(transform_data)
  .then(find something)
  .then(find something from above results)
  .then(format final results)
  ==> To do this, each function must check the structure of input before processing
*/

function find_accounts_plc() {
	debugger;
	return data_bank.then(data => 
		__find_accounts_by_product(data, {type: 'PERSONAL_LINE_CREDIT'})
	).then(__prettyPrintAccount);		
}

function find_accounts_prepaid_visa() {
	return data_bank.then(data => 
		__find_accounts_by_product(data, {type: 'PREPAID_CARD'})
	).then(__prettyPrintAccount);		
}

function find_accounts_for_payment_with_point() {
	const marvel_eligible_cards = ['MXAVW', 'MXAVW', 'MXAPW', 'MXAPW', 'MCPLP', 'MCPLT', 'MCPLR'];	
	return data_bank.then(data => 
		marvel_eligible_cards
			.map( name=> { return { 'type': 'CREDIT_CARD', 'fullName': 'CARD' + name }; })
			.reduce( (bin, product) => bin.concat(__find_accounts_by_product(data, product)), [] )
	).then(__prettyPrintAccount);
}

function find_accounts_for_tfsa_withdrawal() {
	return data_bank.then(data =>
		__find_accounts_by_product(data, {registration: 'TFSA', type: 'SAVINGS'})
	).then(__prettyPrintAccount);
}

function find_accounts_loan() {
	/* Find clients that have loan accounts.
  Ex: registration: NON_REGISTERED, type: LOAN, code: CL, fullname: CLCL@ */
	return data_bank.then(data =>
		__find_accounts_by_product(data, {type: 'LOAN'})
	).then(__prettyPrintAccount);
}

function find_accounts_mortgage() {
	/* Find clients that have mortgage accounts.
  Ex: registration: NON_REGISTERED, type: MORTGAGE, code: MTG, fullname: MTGMTG */
	return data_bank.then(data =>
		__find_accounts_by_product(data, {type: 'MORTGAGE'})
	).then(__prettyPrintAccount);
}

function find_accounts_credit_card() {	
	/* Find clients that have credit cards */
	return data_bank.then(data =>
		__find_accounts_by_product(data, {type: 'CREDIT_CARD'})
	).then(__prettyPrintAccount);
}

function find_accounts_savings() {
	/* Find clients that have savings accounts */
	return data_bank.then(data =>
		__find_accounts_by_product(data, {type: 'SAVINGS'})
	).then(__prettyPrintAccount);
}

function find_accounts_chequing() {
	/* Find clients that have chequing accounts */
	return data_bank.then(data =>
		__find_accounts_by_product(data, {type: 'CHEQUING'})
	).then(__prettyPrintAccount);
}

function find_accounts_usd() {
	/* Find clients that have USD accounts */
	return data_bank.then(data =>
		list_all_accounts(data)
			.filter(acct => acct.balance && acct.balance.currency == 'USD')
	).then(__prettyPrintAccount);
}	

function find_accounts_usd_visa() {
	/* Find clients that have USD VISA */
	return data_bank.then(data =>
		__find_accounts_by_product(data, {type: 'CREDIT_CARD'})
			.filter(acct => acct.number.startsWith('4789') || (acct.balance && acct.balance.currency == 'USD') )			
	).then(__prettyPrintAccount);
}	

function find_clients_not_registered_emt() {
	/* Find clients that have _not- been registered for EMT */
	return data_bank.then(data => {
		let non_emt_clients = _.chain(data)
			.filter( card => _.indexOf(card.entitlements, 'EMT_REGISTER') >=0 )			
			.value();
		return group_card_by_segments(non_emt_clients);
	});
}

function find_clients_registered_emt() {
	/* Find clients that have been registered for EMT */
	return data_bank.then(data => {
		let emt_clients = _.chain(data)
			.filter( card => _.indexOf(card.entitlements, 'EMT_REGISTERED') >=0 )			
			.value();
		return group_card_by_segments(emt_clients);
	});
}

function find_clients_small_business_signatory() {
	return data_bank.then(data => {
		let cards = group_card_by_segments(data);
		return _.pick(cards, 'SMALL_BUSINESS_SIGNATORY');
	});
}

function find_clients_small_business_cosignatory() {
	return data_bank.then(data => {
		let cards = group_card_by_segments(data);
		return _.pick(cards, 'SMALL_BUSINESS_CO_SIGNATORY');
	});
}

function find_clients_small_business_delegate() {
	return data_bank.then(data => {
		let cards = group_card_by_segments(data);
		return _.pick(cards, 'SMALL_BUSINESS_DELEGATE');
	});
}

function find_clients_small_business_unknown() {
	return data_bank.then(data => {
		let cards = group_card_by_segments(data);
		return _.pick(cards, 'SMALL_BUSINESS_UNKNOWN');
	});
}


function find_clients_personal_banking() {
	return data_bank.then(data => {
		let cards = group_card_by_segments(data);
		return _.pick(cards, 'PERSONAL_BANKING');
	});
}

function find_clients_private_wealth() {
	return data_bank.then(data => {
		let cards = group_card_by_segments(data);
		return _.pick(cards, 'PRIVATE_WEALTH');
	});
}

function find_clients_imperial_service() {
	return data_bank.then(data => {
		let cards = group_card_by_segments(data);
		return _.pick(cards, 'IMPERIAL_SERVICE');
	});
}

function find_clients_credit_only() {
	return data_bank.then(data => {
		let cards = group_card_by_segments(data);
		return _.pick(cards, 'CREDIT_ONLY');
	});
}

function find_accounts_by_product_2(all_accounts, this_product) {
	/* this is a memoized version of find_accounts_by_product, 
  for use by list_accounts_by_product_type */
	return all_accounts.filter(acct => _.isMatch(acct.product, this_product));
}


function __find_accounts_by_product(data, this_product) {
	debugger;
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
  
	let product_labels = products.map(t=>_.values(t).join('|'));
  
	let all_accounts = list_all_accounts(data);
  
	let accounts_by_product = products.map(product => find_accounts_by_product_2(all_accounts, product));
  
	let output = _.object(product_labels, accounts_by_product);
  
	// console.timeEnd('list_accounts_by_product_type');
  
	return output;
}

function list_all_products(data) {	
	/* List all products that the clients in the data set have */
	let all_types = 
		_.chain(data)
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

const list_all_accounts_memoized = 
	_.memoize( list_all_accounts_internal, data => data[0]['environment'] + data[0]['local-datetime']);

function list_all_accounts(data) {
	return list_all_accounts_memoized(data);
}

function list_all_accounts_internal(data) {
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


function get_bad_cards() {
	return new Promise((resolve,reject) =>{
		// let json = JSON.parse(data);
		let bad_cards = _.chain(data_bank)
			.values() /* keep only values */
			.filter( item => _.has(item, 'error') && item['error'].indexOf('No PVQs') > 0 )
			.map('card') // .pluck() in underscorce
			.value();	

		resolve(bad_cards);
	});
}

function read_data(data_file) {
	return new Promise((resolve, reject)=>{
		fs.readFile(data_file, 'utf8',(error, content)=>{
			if (error) {
				console.error(error);
				reject({});
			} else {
				resolve(content);
			}
		});	
	})  ;
}


function transform_data(data) {
	return (new Promise((resolve, reject)=>{

		let json = '';
		
		try {
			json = JSON.parse(data);	
		} catch (error) {
			reject(error);
		}
		
		let good_cards = _.chain(json)
			.values() /* keep only values */
			.reject( item => _.has(item, 'error') ) /* remove items with error */
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
    
		let bad_cards = _.chain(json)
			.values() /* keep only values */
			.filter( item => _.has(item, 'error') )
			.map('card') // .pluck() in underscorce
			.value();
    
		// console.log('Good cards: %d, Bad cards: %d', good_cards.length, bad_cards.length);
		// console.log("Bad cards:\n%s", bad_cards.join('\n'));
		resolve(good_cards);
    
		/* Returns: 
      [ { card: '...' 
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
      } ]
    */		
	}));
}