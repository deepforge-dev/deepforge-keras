/* globals define */

// This file is inspired from keras.io TFKerasDocumentationGenerator
// available at https://github.com/keras-team/keras-io/blob/c874c5b27133283561e51ea6651afef396309599/scripts/docstrings.py

define([

], function () {

    class Doc2MarkDown {

        process(docstring) {
            docstring = docstring.replace('Args:', '# Arguments');
            docstring = docstring.replace('Arguments:', '# Arguments');
            docstring = docstring.replace('Attributes:', '# Attributes');
            docstring = docstring.replace('Returns:', '# Returns');
            docstring = docstring.replace('Raises:', '# Raises');
            docstring = docstring.replace('Input shape:', '# Input shape');
            docstring = docstring.replace('Output shape:', '# Output shape');
            docstring = docstring.replace('Call arguments:', '# Call arguments');
            docstring = docstring.replace('Returns:', '# Returns');
            docstring = docstring.replace('Example:', '# Example\n');
            docstring = docstring.replace('Examples:', '# Examples\n');
            docstring = docstring.replace(/\nReference:\n\s*-/,  '\n**Reference**\n\n-');

            docstring = docstring.replace("\n >>> ", "\n>>> ");

            const lines = docstring.split("\n");

            let doctestLines = [], usableLines = [];
            lines.forEach(line => {
                if (doctestLines.length > 0) {
                    if (!line) {
                        this._flushDocsTest(usableLines, doctestLines);
                        doctestLines = [];
                    } else {
                        doctestLines.append(line);
                    }
                } else {
                    if(line.startsWith('>>>')) {

                    } else {
                        usableLines.push(line);
                    }
                }
            });

            if (doctestLines.length > 0){
                this._flushDocsTest(usableLines, doctestLines);
            }

            docstring = usableLines.join('\n');
            return this.toMarkDown(docstring);
        }

        toMarkDown(docstring) {
            let googleStyleSections;
            if (!docstring.endsWith('\n')) {
                docstring += '\n';
            }
            googleStyleSections, docstring = this._getGoogleStyleSections(docstring);
        }


        _getGoogleStyleSections(docstring) {
            let codeBlocks, googleStyleSections;
            codeBlocks, docstring = this._getCodeBlocks(docstring);
            googleStyleSections, docstring = this._getGoogleStyleSectionsWithoutCode(docstring);

        }

        _getGoogleStyleSectionsWithoutCode(docstring) {
            const indentedSectionRegex = new RegExp('\n# .+?\n');
            let googleStyleSections = {};
            while(true) {
                let matchIdx = indentedSectionRegex.search(indentedSectionRegex);
                if(matchIdx === -1) {
                    break;
                }
                let sectionStart = matchIdx + 1;
                let sectionEnd = this._getSectionEnd(docstring, sectionStart);
            }
        }

        _getSectionEnd(docstring, sectionStart) {
            const regexIndentedSectionsEnd = new RegExp('\S\n+(\s|$)');
            // const end =
        }


        _getCodeBlocks(docstring) {
            let codeBlocks = {},
                index, snippet, token;
            let tmp = docstring.slice(0);
            while(tmp.includes('```')) {
                tmp = tmp.slice(tmp.indexOf('```'));
                index = tmp.indexOf('```', 3) + 6;
                snippet = tmp.slice(0, index);
                token = `KERAS_AUTO_DOC_CODE_BLOCK_${Object.keys(codeBlocks).length}`;
                codeBlocks[token] = snippet;
                tmp = tmp.slice(index);
            }
            return codeBlocks, docstring;
        }



        _flushDocsTest(usabaleLines, doctestLines) {
            usabaleLines.push("```shell");
            usabaleLines.push(doctestLines);
            usabaleLines.push("```endshell");
            usabaleLines.push("");
        }

    }



    return Doc2MarkDown;
});
