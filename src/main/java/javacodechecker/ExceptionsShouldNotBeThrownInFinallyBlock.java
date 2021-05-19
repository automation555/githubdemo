package javacodechecker;

public class ExceptionsShouldNotBeThrownInFinallyBlock{
	public void m2() {
		// EMB-ISSUE: CodeIssueNames.EXCEPTION_SHOULD_NOT_BE_THROWN_IN_FINALLY_BLOCK
	try {
		int num=121/0;  
		System.out.println(num);  
		} 
	finally {
		  throw new ArithmeticException();      
		    }
}
	public void m3() {
		// EMB-ISSUE: CodeIssueNames.EXCEPTION_SHOULD_NOT_BE_THROWN_IN_FINALLY_BLOCK/no-detect
		try {
			int num=121/0;  
			System.out.println(num); 
			throw new ArithmeticException();
			} 
		finally {
			
			      
			    }
	}
	
	public void m4() {
		// EMB-ISSUE: CodeIssueNames.EXCEPTION_SHOULD_NOT_BE_THROWN_IN_FINALLY_BLOCK/no-detect
		try {
			int num=121/0;  
			System.out.println(num); 
			} 
		catch(ArithmeticException e) {
			
		}
		finally {
			
			    }
	}
	public void m5() {
		// EMB-ISSUE: CodeIssueNames.EXCEPTION_SHOULD_NOT_BE_THROWN_IN_FINALLY_BLOCK/no-detect
		try {
			int num=121/0;  
			System.out.println(num);
		}
		catch(ArithmeticException e) {
			
		}
	}
}
