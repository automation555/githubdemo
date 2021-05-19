package javacodechecker;

public class EmptyStringShouldNotBeUsed{
	public void md() {
	// EMB-ISSUE: CodeIssueNames.EMPTY_STRING_SHOULD_NOT_BE_USED
	    String s1 = "" + 123;
	// EMB-ISSUE: CodeIssueNames.EMPTY_STRING_SHOULD_NOT_BE_USED
		String s = "" + 123 + "";
	// EMB-ISSUE: CodeIssueNames.EMPTY_STRING_SHOULD_NOT_BE_USED/no-detect
		String t = Integer.toString(456);
	}
	
}
