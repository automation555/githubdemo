package javacodechecker;

import java.security.SecureRandom;

class InitializationOfSecureRandomAtMethodLevel { 
	//Non-compliant code
	public int generateSecureKey() {
		// EMB-ISSUE: CodeIssueNames.INITIALIZATION_OF_SECURE_RANDOM_AT_METHOD_LEVEL
		SecureRandom secureRandom = new SecureRandom();
		return secureRandom.nextInt();                       
	}
}

//compliant code
class SecureRandomGenerator {
	// EMB-ISSUE: CodeIssueNames.INITIALIZATION_OF_SECURE_RANDOM_AT_METHOD_LEVEL/no-detect
	static SecureRandom secureRandom = new SecureRandom();
	public int generateSecureKey() {
		return secureRandom.nextInt();
	}
}