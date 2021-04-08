package javacodechecker;

public class RequestedSessionIdShouldNotBeUsed {

	public void method(HttpServletRequest request) {
		// EMB-ISSUE: CodeIssueNames.REQUESTED_SESSION_ID_SHOULD_NOT_BE_USED
		if(isActiveSession(request.getRequestedSessionId()) ){
			 
		}
	}
}
