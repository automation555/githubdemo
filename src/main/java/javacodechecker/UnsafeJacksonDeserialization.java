package javacodechecker;

import com.fasterxml.jackson.databind.ObjectMapper;

public class UnsafeJacksonDeserialization {

	public void method() {
		ObjectMapper mapper = new ObjectMapper();
    	// EMB-ISSUE: CodeIssueNames.UNSAFE_JACKSON_DESERIALIZATION
		mapper.enableDefaultTyping(); 
	}
}
