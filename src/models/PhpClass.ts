import { PhpProperty } from "./PhpProperty";

export class PhpClass {
    
    name: string;
    properties: PhpProperty[] = [];
    functionNames: string[] = [];
    startLine: number;
    endLine: number;
    
    constructor(name: string, startLine: number, endLine: number) {
        this.name = name;
        this.startLine = startLine;
        this.endLine = endLine;
    }
    
    hasSetter(propertyName: string) {
        let setterFuncName = 'set' + propertyName.toLowerCase();
        for (const func of this.functionNames) {
            if (func.toLowerCase() === setterFuncName) {
                return true;
            }
        }
        return false;
    }
    
    hasGetter(propertyName: string) {
        let getterFuncName = 'get' + propertyName.toLowerCase();
        for (const func of this.functionNames) {
            if (func.toLowerCase() === getterFuncName) {
                return true;
            }
        }
        return false;
    }
    
    alreadyHasAllGetters() {
        for (const prop of this.properties) {
            if (!this.hasGetter(prop.name)) {
                return false;
            }
        }
        return true;
    }
    
    alreadyHasAllSetters() {
        for (const prop of this.properties) {
            if (!this.hasSetter(prop.name)) {
                return false;
            }
        }
        return true;
    }
    
    alreadyHasAllMethods() {
        return this.alreadyHasAllGetters() && this.alreadyHasAllSetters();
    }
    
}