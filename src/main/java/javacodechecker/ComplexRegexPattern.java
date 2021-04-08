package javacodechecker;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Test case for ComplexRegexPattern
 * @author bhides
 *
 */
class ComplexRegexPattern { 
	public void method() {
		String regex = "(a+)+";
		// EMB-ISSUE: CodeIssueNames.COMPLEX_REGEXPATTERN
		Pattern r = Pattern.compile(regex);

		// Now create matcher object.
		Matcher m = r.matcher("");

		// EMB-ISSUE: CodeIssueNames.COMPLEX_REGEXPATTERN
		Pattern r2 = Pattern.compile("(a+)+");
	}
}