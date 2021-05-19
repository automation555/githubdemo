package javacodechecker;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;

class MainShouldNotThrowAnything {
	// EMB-ISSUE: CodeIssueNames.MAIN_SHOULD_NOT_THROW_ANYTHING/no-detect
	 public static void main(String args[]){  
	     System.out.println("Hello");  
	    }  
}
