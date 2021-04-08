package javacodechecker;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;

class EmptyCatchBlock {
	public static void main(String[] args) {
		try {
			FileInputStream in = new FileInputStream(new File(""));
		} 
		// EMB-ISSUE: CodeIssueNames.EMPTY_CATCH_BLOCK
		catch (FileNotFoundException e) {
		}
	}
}