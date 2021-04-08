package javacodechecker;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;

class GettersAndSettersShouldAccessTheExpectedFields {

	private int x ,y ,z;
	
	private boolean active;
	
	// EMB-ISSUE: CodeIssueNames.GETTERS_AND_SETTERS_SHOULD_ACCESS_THE_EXPECTED_FIELDS 
	public void setX(int val) {
		//this is for test
		this.y = val;
	}

	// EMB-ISSUE: CodeIssueNames.GETTERS_AND_SETTERS_SHOULD_ACCESS_THE_EXPECTED_FIELDS 
	public int getY() {
		return this.x;
	}

	// EMB-ISSUE: CodeIssueNames.GETTERS_AND_SETTERS_SHOULD_ACCESS_THE_EXPECTED_FIELDS
	  public boolean isActive()
		  {
		    return x;
		  }

	  		// EMB-ISSUE: CodeIssueNames.GETTERS_AND_SETTERS_SHOULD_ACCESS_THE_EXPECTED_FIELDS
		  public void setActive(boolean b)
		  {
		    this.y = b;
		  }
		  
		  // EMB-ISSUE: CodeIssueNames.GETTERS_AND_SETTERS_SHOULD_ACCESS_THE_EXPECTED_FIELDS/no-detect
		  public int getName() {	
			  System.out.println(" ");
			  return this.x;
			}
		  
			// EMB-ISSUE: CodeIssueNames.GETTERS_AND_SETTERS_SHOULD_ACCESS_THE_EXPECTED_FIELDS/no-detect
		  	public void setName(int val) {
			    System.out.println(" ");
				this.y = val;
			}
		  	
		 // EMB-ISSUE: CodeIssueNames.GETTERS_AND_SETTERS_SHOULD_ACCESS_THE_EXPECTED_FIELDS/no-detect 
			public void setZ(int val) {
				this.z = val;
			}
			
			
}
