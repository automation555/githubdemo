package javacodechecker;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;

class MainShouldNotThrowAnything {
	// EMB-ISSUE: CodeIssueNames.MAIN_SHOULD_NOT_THROW_ANYTHING
	 public static void main(String args[]) throws Exception{  
	     System.out.println("Hello");  
	    }  
}