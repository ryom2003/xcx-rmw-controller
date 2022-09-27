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
        if (this.controller) {
            this.controller.stop();
        }

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
                await this.port.open({baudRate: 38400});

                this.reader = this.port.readable.getReader();
                this.writer = this.port.writable.getWriter();

                this.controller = new RmwController(this.reader, this.writer);
                await this.controller.connect();

                this.controller.start();
                console.log('controller started.');

            } catch (e) {
                console.log(e);
                console.log("failed to connect.");
                await this.close();
            }
        }
    }

    async axis (args) {
        if (!this.controller) return 0;
        return this.controller.axis(args.AXIS);
    }

    async button(args) {
        if (!this.controller) return false;
        return this.controller.button(args.SLOT);
    }

    async pushed(args) {
        if (!this.controller) return false;
        return this.controller.pushed(args.SLOT);
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
                        id: 'rmw-controller.axis',
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
                        id: 'rmw-controller.button',
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
                /*{
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
                    },
                    //isEdgeActivated: true
                }*/
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
        this._interval = null;
        this._reading = false;

        this._reader = reader;
        this._writer = writer;
        this._decoder = new TextDecoder('ascii');
        //this.line = '';
        this._axisValues = new Map([["X", 0], ["Y", 0]]);
        this._buttons = new Map();
        this._buttons.set("A", new Button());
        this._buttons.set("B", new Button());
        this._buttons.set("C", new Button());
    }

    async connect() {
        const result = await this._command('0');
        if (result == 'RMWC001') {
            console.log('controller connected.');
        } else {
            throw 'not compatible.';
        }
    }

    start() {
        if (this._reader && !this._interval) {
            this._interval = setInterval(this._read.bind(this), 50);
        }
    }

    stop() {
        if (this._reader && this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }

    async _read() {
        if (this._reading) {
            console.log("*");
            return;
        }

        this._reading = true;

        const line = await this._command('A');
         
        const values = line.split('|');
        
        this._buttons.get("A").update(Boolean(Number(values[0])));
        this._buttons.get("B").update(Boolean(Number(values[1])));
        this._buttons.get("C").update(Boolean(Number(values[2])));
        this._axisValues.set("X", Number(values[3]));
        this._axisValues.set("Y", Number(values[4]));

        this._reading = false;
    }
    
    async _command (c) {
        //console.log("Command: " + c);
        let response = '?';
        let line = ''; //this.line;
        const writer = this._writer;
        const reader = this._reader;
        const decoder = this._decoder;
        
        // Send command
        const data = new Uint8Array([c.charCodeAt(0)]);
        await writer.write(data);

        function readChunk({done, value}) {
            return new Promise((resolve, reject) => {
                if (done) {
                    reject('stream done.');
                } else {
                    line += decoder.decode(value);
                    //console.log("[" + line + "]");
                    const pos = line.indexOf("\r\n");
                    if (pos >= 0) {
                        response = line.substring(0, pos);
                        resolve();
                    } else {
                        reader.read().then(readChunk).then(resolve);
                    }
                }
            });
        };

        // Receive response
        await reader.read().then(readChunk);

        //console.log("Response: " + response);
        return response;
    }


    axis(axisName) {
        if (!this._axisValues.has(axisName)) return 0;
        return this._axisValues.get(axisName);
    }

    button(buttonName) {
        if (!this._buttons.has(buttonName)) return false;
        return this._buttons.get(buttonName).pushed();
    }

    pushed(buttonName) {
        if (!this._buttons.has(buttonName)) return false;
        return this._buttons.get(buttonName).on_push();
    }
}

class Button {
    
    constructor () {
        this._interval = 5;
        this._count = 0;
        this._pushed = false;
        this._push_recorded = false;
    }

    update (pushed) {
        if (this._count == 0) {
            if (pushed) {
                this._count = this._interval;
                this._pushed = true;
                this._push_recorded = true;
                //console.log("push!");
            } else {
                this._pushed = false;
            }
        } else {
            if (!pushed) {
                this._pushed = false;
            }
            this._count--;
        }
    }

    pushed () {
        return this._pushed;
    }

    on_push () {
        if (this._push_recorded) {
            this._push_recorded = false;
            console.log("on push");
            return true;
        } else {
            return false;
        }
    }
}

export {
    ExtensionBlocks as default,
    ExtensionBlocks as blockClass
};
