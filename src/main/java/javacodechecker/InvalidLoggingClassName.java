package javacodechecker;

import org.apache.logging.log4j.Logger;

public class InvalidLoggingClassName {

	// EMB-ISSUE: CodeIssueNames.INVALID_LOGGING_CLASS_NAME
	private static Logger logger = org.apache.logging.log4j.LogManager
			.getLogger(SomeOtherClass.class);
}
