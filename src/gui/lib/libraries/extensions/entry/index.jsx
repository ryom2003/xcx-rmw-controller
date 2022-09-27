/**
 * This is an extension for Xcratch.
 */

import iconURL from './rmw_controller.png';
import insetIconURL from './rmw_controller-small.png';
import translations from './translations.json';

/**
 * Formatter to translate the messages in this extension.
 * This will be replaced which is used in the React component.
 * @param {object} messageData - data for format-message
 * @returns {string} - translated message for the current locale
 */
let formatMessage = messageData => messageData.defaultMessage;

const entry = {
    get name () {
        return formatMessage({
            id: 'rmwController.entry.name',
            default: 'RMW Controller',
            description: 'name of the extension'
        });
    },
    extensionId: 'rmwController',
    extensionURL: 'https://ryom2003.github.io/xcx-rmw-controller/dist/rmwController.mjs',
    collaborator: 'ryom2003',
    iconURL: iconURL,
    insetIconURL: insetIconURL,
    get description () {
        return formatMessage({
            defaultMessage: 'an extension for Xcratch',
            description: 'Description for this extension',
            id: 'rmwController.entry.description'
        });
    },
    featured: true,
    disabled: false,
    bluetoothRequired: false,
    internetConnectionRequired: false,
    helpLink: 'https://ryom2003.github.io/xcx-rmw-controller/',
    setFormatMessage: formatter => {
        formatMessage = formatter;
    },
    translationMap: translations
};

export {entry}; // loadable-extension needs this line.
export default entry;
