package javacodechecker; 


import java.util.ArrayList;
import java.util.List;

class ReturnEmptyArrayOrCollectionInsteadOfNull {     
	
	private void method() {
		getStringArray();
	}
	
	private List<String> getStringArray() {
		// EMB-ISSUE: CodeIssueNames.RETURN_EMPTY_ARRAY_OR_COLLECTION_INSTEADOF_NULL
		return null;
	}
	
	private List<String> getStringArray2() {
		return new ArrayList<String>();
	}
}