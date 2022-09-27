import BlockType from '../../extension-support/block-type';
import ArgumentType from '../../extension-support/argument-type';
import Cast from '../../util/cast';
import translations from './translations.json';
import blockIcon from './block-icon.png';

/**
 * Formatter which is used for translation.
 * This will be replaced which is used in the runtime.
 * @param {object} messageData - format-message object
 * @returns {string} - message for the locale
 */
let formatMessage = messageData => messageData.defaultMessage;

/**
 * Setup format-message for this extension.
 */
const setupTranslations = () => {
    const localeSetup = formatMessage.setup();
    if (localeSetup && localeSetup.translations[localeSetup.locale]) {
        Object.assign(
            localeSetup.translations[localeSetup.locale],
            translations[localeSetup.locale]
        );
    }
};

const EXTENSION_ID = 'rmwController';

//const { SerialPort } = require('serialport');
//const { ReadlineParser } = require('@serialport/parser-readline');
//const bindings = require('@serialport/bindings');
//let controllers = new Array();

/**
 * URL to get this extension as a module.
 * When it was loaded as a module, 'extensionURL' will be replaced a URL which is retrieved from.
 * @type {string}
 */
let extensionURL = 'https://ryom2003.github.io/xcx-rmw-controller/dist/rmwController.mjs';

/**
 * Scratch 3.0 blocks for example of Xcratch.
 */
class ExtensionBlocks {

    /**
     * @return {string} - the name of this extension.
     */
    static get EXTENSION_NAME () {
        return formatMessage({
            id: 'rmwController.name',
            default: 'RMW Controller',
            description: 'name of the extension'
        });
    }

    /**
     * @return {string} - the ID of this extension.
     */
    static get EXTENSION_ID () {
        return EXTENSION_ID;
    }

    /**
     * URL to get this extension.
     * @type {string}
     */
    static get extensionURL () {
        return extensionURL;
    }

    /**
     * Set URL to get this extension.
     * The extensionURL will be changed to the URL of the loading server.
     * @param {string} url - URL
     */
    static set extensionURL (url) {
        extensionURL = url;
    }

    /**
     * Construct a set of blocks for 'RMW.
     * @param {Runtime} runtime - the Scratch 3.0 runtime.
     */
    constructor (runtime) {
        /**
         * The Scratch 3.0 runtime.
         * @type {Runtime}
         */
        this.runtime = runtime;

        if (runtime.formatMessage) {
            // Replace 'formatMessage' to a formatter which is used in the runtime.
            formatMessage = runtime.formatMessage;
        }

        this.port = null;
        this.reader = null;
        this.writer = null;
        
        this.controller = null;

        //const autoConnect = setInterval(this.connect, 3000);
        this.runtime.on('PROJECT_LOADED', () => {
            console.log('PROJECT_LOADED');
        });
        this.runtime.on('PROJECT_CHANGED', () => {
            console.log('PROJECT_CHANGED');
        });
        this.runtime.on('PROJECT_START', () => {
            console.log('PROJECT_START');
            this.connect();
        });
        this.runtime.on('PROJECT_STOP_ALL', () => {
            console.log('PROJECT_STOP_ALL');
            this.close();
        });

    }

    async close() {
        if (this.port) {
            try {
                await this.reader.cancel();
                await this.reader.releaseLock();
                await this.writer.releaseLock();
                //await this.writer.close();
                await this.port.close();
            } catch (e) {
                console.log(e);
            }
        }
        this.port = null;
        this.controller = null;
    }

    async connect () {
        console.log('Connecting to controller...');
        if (this.port == null) {
            try {
                this.port = await navigator.serial.requestPort();
                await this.port.open({baudRate: 9600});

                this.reader = this.port.readable.getReader();
                this.writer = this.port.writable.getWriter();

                this.controller = new RmwController(this.reader, this.writer);
                await this.controller.connect();

            } catch (e) {
                console.log(e);
                console.log("failed to connect.");
                await this.close();
            }
        }
    }

    async axis (args) {
        if (!this.controller) return 0;
        return await this.controller.axis(args.AXIS);
    }

    async button(args) {
        if (!this.controller) return false;
        return await this.controller.button(args.SLOT);
    }

    async pushed(args) {
        if (!this.controller) return false;
        return await this.controller.pushed(args.SLOT);
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo () {
        setupTranslations();
        return {
            id: ExtensionBlocks.EXTENSION_ID,
            name: ExtensionBlocks.EXTENSION_NAME,
            extensionURL: ExtensionBlocks.extensionURL,
            blockIconURI: blockIcon,
            showStatusButton: false,
            blocks: [
                {
                    opcode: 'axis',
                    blockType: BlockType.REPORTER,
                    blockAllThreads: false,
                    text: formatMessage({
                        id: 'rmwController.axis',
                        default: 'axis [AXIS]',
                        description: 'value of axis [AXIS]'
                    }),
                    func: 'axis',
                    arguments: {
                        AXIS: {
                            type: ArgumentType.STRING,
                            defaultValue: "X",
                            menu: "axisNameMenu"
                        }
                    }
                },
                {
                    opcode: 'button',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'rmwController.button',
                        default: 'button [SLOT]',
                        description: 'button [SLOT] is pushed'
                    }),
                    func: 'button',
                    arguments: {
                        SLOT: {
                            type: ArgumentType.STRING,
                            defaultValue: "A",
                            menu: "buttonNameMenu"
                        }
                    }
                },
                {
                    opcode: 'pushed',
                    blockType: BlockType.HAT,
                    text: formatMessage({
                        id: 'rmwController.pushed',
                        default: 'when [SLOT] is pushed',
                        description: 'when button [SLOT] is pushed'
                    }),
                    func: 'pushed',
                    arguments: {
                        SLOT: {
                            type: ArgumentType.STRING,
                            defaultValue: "A",
                            menu: "buttonNameMenu"
                        }
                    }
                }
            ],
            menus: {
                axisNameMenu: {
                    acceptReporters: false,
                    items: ['X', 'Y']
                },
                buttonNameMenu: {
                    acceptReporters: false,
                    items: ['A', 'B', 'C']
                }
            }
        };
    }

}

class RmwController {

    constructor (reader, writer) {
        this.reader = reader;
        this.writer = writer;
        this.decoder = new TextDecoder('ascii');
        this.line = '';
        this.axisMap = new Map([["X", '4'], ["Y", '5']]);
        this.buttonMap = new Map([["A", '1'], ["B", '2'], ["C", '3']]);
        this.previousButtons = new Map([["A", false], ["B", false], ["C", false]]);
    }

    async connect() {
        const result = await this.command('0');
        if (result == 'RMWC001') {
            console.log('controller connected.');
        } else {
            throw 'not compatible.';
        }
    }

    async axis(axisName) {
        if (!this.axisMap.has(axisName)) return 0;

        const value = await this.command(this.axisMap.get(axisName));
        return Number(value);
    }

    async button(buttonName) {
        if (!this.buttonMap.has(buttonName)) return false;

        const value = await this.command(this.buttonMap.get(buttonName));
        const current = Boolean(Number(value));
        this.previousButtons.set(buttonName, current);
        return current;
    }

    async pushed(buttonName) {
        if (!this.buttonMap.has(buttonName)) return false;

        const value = await this.command(this.buttonMap.get(buttonName));
        const current = Boolean(Number(value));
        const pushed = (current && !this.previousButtons.get(buttonName) ? true : false);
        this.previousButtons.set(buttonName, current);
        return pushed;
    }

    async command (c) {
        let response = '?';
        let line = ''; //this.line;
        const writer = this.writer;
        const reader = this.reader;
        const decoder = this.decoder;
        
        // Send command
        const data = new Uint8Array([c.charCodeAt(0)]);
        await writer.write(data).then(() => {
            console.log("Command: " + c);
        });

        function readChunk({done, value}) {
            if (done) {
                throw 'stream done.';
            } else {
                line += decoder.decode(value);
                const pos = line.indexOf("\r\n");
                if (pos > 0) {
                    response = line.substring(0, pos);
                    console.log("Rest: " + line.substring(pos + 2));
                    //line = line.substring(pos + 2);
                    return new Promise((resolve) => {
                        resolve();
                    });
                }
            }
            reader.read().then(({done, value}) => {
                return readChunk({done, value});
            });                
        };

        // Receive response
        await reader.read().then(readChunk);
        //this.line = line;

        console.log("Command: " + c + "  Response: " + response);
        return response;
    }
}

export {
    ExtensionBlocks as default,
    ExtensionBlocks as blockClass
};
