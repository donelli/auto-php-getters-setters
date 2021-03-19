import * as vscode from 'vscode';
import * as phpParser from 'php-parser';
import { parse } from 'node:path';
import { PhpClass } from '../models/PhpClass';
import { PhpProperty } from '../models/PhpProperty';

var engine = require('php-parser');

interface GenerateParams {
  getters: boolean,
  setters: boolean
}

export async function generateGettersAndSetters(params: GenerateParams) {

  const activeEditor = vscode.window.activeTextEditor;

  if (!activeEditor) {
    vscode.window.showErrorMessage('There is no active editor!');
    return;
  }

  const parsedFile = parseFile(activeEditor.document);
  
  if (!parsedFile) {
    vscode.window.showErrorMessage('Error on file parsing!');
    return;
  }
  
  const classes = findClassesInParsedFile(parsedFile);
  
  if (classes.length === 0) {
    vscode.window.showErrorMessage('No classes found in this file!');
    return;
  }
  
  selectClasses(classes, params)
  .then(selectedClasses => {
    
    
    
  }, () => {});
  
}

function parseFile(document: vscode.TextDocument) {
  
  const parser = new engine({
    parser: {
      extractDoc: true,
      php7: true
    },
    ast: {
      withPositions: true
    }
  });

  const parsedFile = parser.parseCode(document.getText());
  
  if (!parsedFile) {
    return null;
  }
  
  return parsedFile;
}

function findClassesInParsedFile(parsedFile: phpParser.Program): PhpClass[] {
  
  const possiblyClasses = parsedFile.children ?? [];
  const classes: PhpClass[] = [];
  
  for (const c of possiblyClasses) {
    if (c.kind === 'class') {
      
      const phpClass = new PhpClass( (c as any).name.name );
      
      for (const property of (c as any).body) {
        
        switch (property.kind) {
          case 'propertystatement':
            
            if (property.visibility !== 'public') {
              continue;
            }
            
            const prop = property.properties[0];
            const phpProp = new PhpProperty(prop.name.name);
            
            if (prop.type !== null) {
              phpProp.type = prop.type.raw;
            }
            
            phpClass.properties.push(phpProp);
            
            break;
        
          case 'method':
            
            phpClass.functionNames.push(property.name.name);
            
            break;
        }
        
      }
      
      if (phpClass.properties.length === 0) {
        continue;
      }
      
      classes.push(phpClass);
      
    }
  }
  
  return classes;
}

function selectClasses(classes: PhpClass[], params: GenerateParams) {
  
  if (classes.length === 1) {
    return Promise.resolve(classes);
  }
  
  return new Promise<PhpClass[]>((resolve, reject) => {
    
    const quickPick = vscode.window.createQuickPick();
    const items: vscode.QuickPickItem[] = [];
    const selectedItems: vscode.QuickPickItem[] = [];
    
    for (const c of classes) {
      
      const className = c.name;
      
      let item = {
        label: className,
        picked: true
      };
      
      items.push(item);
      
      if (params.getters && params.setters) {
        if (c.alreadyHasAllMethods()) {
          continue;
        }
      } else if (params.getters) {
        if (c.alreadyHasAllGetters()) {
          continue;
        }
      } else if (params.setters) {
        if (c.alreadyHasAllSetters()) {
          continue;
        }
      }
      
      selectedItems.push(item);
      
    }
    
    quickPick.ignoreFocusOut = true;
    quickPick.canSelectMany = true;
    quickPick.items = items;
    quickPick.selectedItems = selectedItems;
    quickPick.title = 'Select classes to generate';
    
    let isResolved = false;
    
    quickPick.onDidAccept((e) => {
      isResolved = true;
      
      const resolveClasses: PhpClass[] = [];
      
      for (const selectedItem of quickPick.selectedItems) {
        
        for (let i = 0; i < classes.length; i++) {
          const c = classes[i];
          
          if (selectedItem.label === c.name) {
            resolveClasses.push(c);
            break;
          }
          
        }
        
      }
      
      resolve(resolveClasses);
      
      quickPick.dispose();
    });
    
    quickPick.onDidHide(() => {
      if (!isResolved) {
        reject();
      }
    });
    
    quickPick.show();
    
  });
  
}
