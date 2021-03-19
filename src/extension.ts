
import * as vscode from 'vscode';
import { generateGettersAndSetters } from './commands/generate_getters_and_setters';

export function activate(context: vscode.ExtensionContext) {

	console.log('active');
	
	registerCommands(context);
	
}

function registerCommands(context: vscode.ExtensionContext) {
	
	context.subscriptions.push(vscode.commands.registerCommand('auto-php-getters-setters.autoGenerateGettersSetters', () => generateGettersAndSetters({ getters: true, setters: true })));
	context.subscriptions.push(vscode.commands.registerCommand('auto-php-getters-setters.autoGenerateGetters', () => generateGettersAndSetters({ getters: true, setters: false })));
	context.subscriptions.push(vscode.commands.registerCommand('auto-php-getters-setters.autoGenerateSetters', () => generateGettersAndSetters({ getters: false, setters: true })));
	
}

export function deactivate() {}
