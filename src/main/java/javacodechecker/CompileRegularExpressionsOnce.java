package javacodechecker;

import java.util.regex.MatchResult;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

class CompileRegularExpressionsOnce { 
	Pattern pattern2 = Pattern.compile("(.*)");
	
    void findText(String inputText) {
    	// EMB-ISSUE: CodeIssueNames.COMPILE_REGULAR_EXPRESSIONS_ONCE
        Pattern pattern = Pattern.compile("(.*)");
        Matcher matcher = pattern.matcher(inputText);
        if(matcher.find()) {
            MatchResult result = matcher.toMatchResult();       
        }
    }
    
    void findText2(String inputText) {
        Matcher matcher = pattern2.matcher(inputText);
        if(matcher.find()) {
            MatchResult result = matcher.toMatchResult();       
        }
    }
}