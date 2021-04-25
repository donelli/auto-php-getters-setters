import * as vscode from 'vscode';
import * as phpParser from 'php-parser';
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
  
  if (classes === undefined) {
    vscode.window.showErrorMessage('No classes found in this file!');
    return;
  } else if (classes.length === 0) {
    vscode.window.showInformationMessage('No private properties found in class!');
    return;
  }
  
  selectClasses(classes, params)
  .then(selectedClasses => {
    
    if (selectedClasses.length === 0) {
      return;
    }
    
    applyEdits(selectedClasses, activeEditor, params);
    
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
  
  let parsedFile;
  try {
    parsedFile = parser.parseCode(document.getText());
  } catch (error) {
    console.error(error);
  }
  
  if (!parsedFile) {
    return null;
  }
  
  return parsedFile;
}

function findClassesInParsedFile(parsedFile: phpParser.Program): PhpClass[] | undefined {
  
  const possiblyClasses = parsedFile.children ?? [];
  const classes: PhpClass[] = [];
  let hasClass = false;
  
  for (const c of possiblyClasses) {
    if (c.kind === 'class') {
      
      hasClass = true;
      const phpClass = new PhpClass( (c as any).name.name, c.loc.start.line.valueOf(), c.loc.end.line.valueOf());
      
      for (const property of (c as any).body) {
        
        switch (property.kind) {
          case 'propertystatement':
            
            if (property.visibility !== 'private') {
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
  
  if (classes.length === 0) {
    return hasClass ? [] : undefined;
  }
  
  return classes;
}

function selectClasses(classes: PhpClass[], params: GenerateParams) {
  
  return new Promise<PhpClass[]>((resolve, reject) => {
    
    const items: vscode.QuickPickItem[] = [];
    const selectedItems: vscode.QuickPickItem[] = [];
    
    for (const c of classes) {
      
      const className = c.name;
      
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
      
      let item = {
        label: className,
        picked: true
      };
      
      items.push(item);
      
      selectedItems.push(item);
      
    }
    
    console.log(items);
    
    
    if (items.length === 0) {
      vscode.window.showInformationMessage('All classes already have getters/setters!');
      return;
    }
    
    const quickPick = vscode.window.createQuickPick();
    
    quickPick.ignoreFocusOut = true;
    quickPick.canSelectMany = true;
    quickPick.items = items;
    quickPick.selectedItems = selectedItems;
    quickPick.title = 'Select classes to generate ' + getTitleFromParams(params);
    
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

function applyEdits(selectedClasses: PhpClass[], activeEditor: vscode.TextEditor, params: GenerateParams) {
  
  let tabSize = 4;
  if (typeof activeEditor.options.tabSize === 'number') {
    tabSize = activeEditor.options.tabSize;
  }
  
  let edits: {
    position: vscode.Position | vscode.Range,
    string: string
  }[] = [];
  
  for (const phpClass of selectedClasses) {
    
    let position;
    let strReplace = '\n';
    
    let lineNum = phpClass.endLine - 2;
    let endLine = lineNum;
    const line = activeEditor.document.lineAt(lineNum);
    
    if (line.isEmptyOrWhitespace) {
      
      for (let i = lineNum - 1; i >= phpClass.startLine; i--) {
        
        const lineAux = activeEditor.document.lineAt(i);
        
        if (lineAux.isEmptyOrWhitespace) {
          lineNum = i;
        } else {
          break;
        }
        
      }
      
      position = new vscode.Range(new vscode.Position(lineNum, tabSize), new vscode.Position(endLine, tabSize));
    } else {
      strReplace += '\n';
      position = new vscode.Position(lineNum, line.text.length);
    }
    
    for (const prop of phpClass.properties) {
      
      const hasGetter = phpClass.hasGetter(prop.name);
      const hasSetter = phpClass.hasSetter(prop.name);
      
      let propName = prop.name.substr(0, 1).toUpperCase() + prop.name.substr(1);
      
      if (!hasGetter && params.getters) {
        strReplace += ' '.repeat(tabSize) + 'public function get' + propName + '() {\n';
        strReplace += ' '.repeat(tabSize * 2) + 'return $this->' + prop.name + ';\n';
        strReplace += ' '.repeat(tabSize) + '}\n\n';
      }
      
      if (!hasSetter && params.setters) {
        strReplace += ' '.repeat(tabSize) + 'public function set' + propName + '(' + (prop.type ? (prop.type + ' ') : '') + '$' + prop.name + ') {\n';
        strReplace += ' '.repeat(tabSize * 2) + '$this->' + prop.name + ' = $' + prop.name + ';\n';
        strReplace += ' '.repeat(tabSize) + '}\n\n';
      }
      
    }
    
    if (strReplace.endsWith('\n\n')) {
      strReplace = strReplace.substr(0, strReplace.length - 1);
    }
    
    edits.push({
      position: position,
      string: strReplace
    });
    
  }
  
  console.log(edits);
  
  activeEditor.edit((builder) => {
    
    for (const edit of edits) {
      builder.replace(edit.position, edit.string);
    }
    
  });
  
}

function getTitleFromParams(params: GenerateParams) {
  
  if (params.setters && params.getters) {
    return 'Getters/Setters';
  }
  
  if (params.getters) {
    return 'Getters';
  }
  
  return 'Setters';
}
