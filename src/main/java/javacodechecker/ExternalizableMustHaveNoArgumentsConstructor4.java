package javacodechecker;

import java.io.Externalizable;
import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectOutput;


//EMB-ISSUE: CodeIssueNames.EXTERNALIZABLE_MUST_HAVE_NO_ARGUMENTS_CONSTRUCTOR/no-detect
public class ExternalizableMustHaveNoArgumentsConstructor4 implements Externalizable {
	private String name;
	private int age;

	 public ExternalizableMustHaveNoArgumentsConstructor4(String name, int age) {
			this.name = name;
			this.age = age;
		}
	 
	 public ExternalizableMustHaveNoArgumentsConstructor4() {
		
	 }
	 
}