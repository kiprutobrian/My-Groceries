require('dotenv').config(); // load configs from .env

const log = require('signale');

const { Elarian } = require('elarian');

let client;

const smsChannel = {
    number: process.env.SMS_SHORT_CODE,
    channel: 'sms',
};

const mpesaChannel = {
    number: process.env.MPESA_PAYBILL,
    channel: 'cellular',
};

const purseId = process.env.PURSE_ID;

const makeOrder = async (customer) => {
    log.info(`Processing order from ${customer.customerNumber.number}`);
    const {
        items,
    } = await customer.getMetadata();
    const salesPerson = new client.Customer({
        provider: 'cellular',
        number: '+254715645950'
    })
    await salesPerson.sendMessage(
        smsChannel, {
            body: {
                text: `The following items have been ordered:\n ${items},\n What is the bill?`,
            },
        },
    );
    await customer.deleteMetadata(['items', 'screen']); // clear state
    await customer.deleteAppData();
};

const processUssd = async (notification, customer, appData, callback) => {
    try {
        log.info(`Processing USSD from ${customer.customerNumber.number}`);
        const input = notification.input.text;

        let screen = 'home';
        if (appData) {
            screen = appData.screen;
        }

        const customerData = await customer.getMetadata();
        let {
            items = "",
        } = customerData;
        const menu = {
            text: null,
            isTerminal: false,
        };
        let nextScreen = screen;
        if (screen === 'home' && input !== '') {
            if (input === '1') {
                nextScreen = 'request-list';
            } else if (input === '2') {
                nextScreen = 'quit';
            }
        }
        if (screen === 'home' && input === '') {
            
        }
        switch (nextScreen) {
        case 'quit':
            menu.text = 'Thank you for shopping!';
            menu.isTerminal = true;
            nextScreen = 'home';
            callback(menu, {
                screen: nextScreen,
            });
            break;
        case 'request-list':
            menu.text = 'Alright, what would like delivered today? (sepparte each item with a space")';
            nextScreen = 'display-items';
            callback(menu, {
                screen: nextScreen,
            });
            break;
        case 'display-items':
            items = input;
            items = items.replace(" ", "\n")
            menu.text = `Okay you selected these items: \n ${items} \n Is that correct??`;
            nextScreen = 'finish-order';
            callback(menu, {
                screen: nextScreen,
            });
            break;
        case 'finish-order':
            acceptance = input;
            if (acceptance == "Yes" || acceptance == "yes"){
                menu.text = `Thanks for the order we'll send you an sms on the order amount.\n Have a nice Day`
            }else{
                menu.text = `Thank you for using the service.\n Have a nice Day`
            }
            menu.isTerminal = true;
            nextScreen = 'home';
            callback(menu, {
                screen: nextScreen,
            });
            await makeOrder(customer);
            break;
        case 'home':
        default:
            menu.text = 'Welcome to My Groceries!\n1. Buy Some Groceries\n2. Quit';
            menu.isTerminal = false;
            callback(menu, {
                screen: nextScreen,
            });
            break;
        }
        await customer.updateMetadata({
            items,
        });
    } catch (error) {
        log.error('USSD Error: ', error);
    }
};

const start = () => {
    client = new Elarian({
        appId: process.env.APP_ID,
        orgId: process.env.ORG_ID,
        apiKey: process.env.API_KEY,
    });

    client.on('ussdSession', processUssd);

    client
        .on('error', (error) => {
            log.warn(`${error.message || error} Attempting to reconnect...`);
            client.connect();
        })
        .on('connected', () => {
            log.success(`App is connected, waiting for customers on ${process.env.USSD_CODE}`);
        })
        .connect();
};
start();